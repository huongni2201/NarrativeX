package com.narrativex.backend.feature.generation.infrastructure.realtime;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.Mockito;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;

class GenerationNotificationListenerTest {
  private final GenerationEventHub hub = mock(GenerationEventHub.class);

  @Test
  void deliversNotificationsAndResyncsOnlyAfterReconnecting() throws Exception {
    PGNotification notification = mock(PGNotification.class);
    when(notification.getParameter()).thenReturn("{\"payload\":1}");
    Connection first = connection(new PGNotification[] {notification}, new SQLException("down"));
    Connection second = connection(null, null);
    AtomicInteger opens = new AtomicInteger();
    GenerationNotificationListener listener =
        new GenerationNotificationListener(
            () -> opens.getAndIncrement() == 0 ? first : second,
            hub,
            Duration.ofMillis(10),
            Duration.ofMillis(50));

    try {
      listener.start();
      verify(hub, timeout(2000)).resync();
      InOrder order = Mockito.inOrder(hub);
      order.verify(hub).onNotification("{\"payload\":1}");
      order.verify(hub).resync();
      verify(first.createStatement()).execute("LISTEN " + GenerationNotificationListener.CHANNEL);
      verify(second.createStatement()).execute("LISTEN " + GenerationNotificationListener.CHANNEL);
    } finally {
      listener.stop();
    }
  }

  @Test
  void retriesWithBackoffWhenTheDatabaseIsUnavailableAndNeverResyncsBeforeTheFirstConnection()
      throws Exception {
    Connection healthy = connection(null, null);
    AtomicInteger opens = new AtomicInteger();
    GenerationNotificationListener listener =
        new GenerationNotificationListener(
            () -> {
              if (opens.getAndIncrement() < 3) throw new SQLException("refused");
              return healthy;
            },
            hub,
            Duration.ofMillis(5),
            Duration.ofMillis(20));

    try {
      listener.start();
      verify(healthy.createStatement(), timeout(3000))
          .execute("LISTEN " + GenerationNotificationListener.CHANNEL);
      verify(hub, never()).resync();
    } finally {
      listener.stop();
    }
  }

  private static Connection connection(PGNotification[] first, SQLException thenFail)
      throws Exception {
    Connection connection = mock(Connection.class);
    Statement statement = mock(Statement.class);
    PGConnection postgres = mock(PGConnection.class);
    when(connection.createStatement()).thenReturn(statement);
    when(connection.unwrap(PGConnection.class)).thenReturn(postgres);
    if (first != null) {
      when(postgres.getNotifications(Mockito.anyInt())).thenReturn(first).thenThrow(thenFail);
    } else {
      when(postgres.getNotifications(Mockito.anyInt())).thenReturn((PGNotification[]) null);
    }
    return connection;
  }
}
