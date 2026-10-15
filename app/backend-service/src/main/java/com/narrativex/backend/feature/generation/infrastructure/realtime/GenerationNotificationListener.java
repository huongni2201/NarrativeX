package com.narrativex.backend.feature.generation.infrastructure.realtime;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Properties;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.stereotype.Component;

/**
 * Listens to {@code narrativex_generation_events} on a dedicated connection that is opened with
 * {@link DriverManager}, so it never occupies a Hikari connection. After every successful reconnect
 * the hub is told to {@link GenerationEventHub#resync()} because notifications sent while the
 * connection was down are lost.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "narrativex.generation.sse.mode", havingValue = "notify")
public class GenerationNotificationListener {
  static final String CHANNEL = "narrativex_generation_events";
  private static final Duration INITIAL_BACKOFF = Duration.ofSeconds(1);
  private static final Duration MAX_BACKOFF = Duration.ofSeconds(30);
  private static final int POLL_TIMEOUT_MILLIS = 1000;

  /** Opens a fresh, listener-owned connection. */
  @FunctionalInterface
  interface ConnectionFactory {
    Connection open() throws SQLException;
  }

  private final ConnectionFactory connectionFactory;
  private final GenerationEventHub hub;
  private final Duration initialBackoff;
  private final Duration maxBackoff;
  private volatile boolean running;
  private volatile Thread thread;

  @Autowired
  public GenerationNotificationListener(DataSourceProperties properties, GenerationEventHub hub) {
    this(() -> open(properties), hub, INITIAL_BACKOFF, MAX_BACKOFF);
  }

  GenerationNotificationListener(
      ConnectionFactory connectionFactory,
      GenerationEventHub hub,
      Duration initialBackoff,
      Duration maxBackoff) {
    this.connectionFactory = connectionFactory;
    this.hub = hub;
    this.initialBackoff = initialBackoff;
    this.maxBackoff = maxBackoff;
  }

  @PostConstruct
  void start() {
    running = true;
    Thread listenerThread = new Thread(this::listenUntilStopped, "generation-notify-listener");
    listenerThread.setDaemon(true);
    thread = listenerThread;
    listenerThread.start();
  }

  @PreDestroy
  void stop() {
    running = false;
    Thread listenerThread = thread;
    if (listenerThread != null) listenerThread.interrupt();
  }

  private void listenUntilStopped() {
    Duration backoff = initialBackoff;
    boolean connectedBefore = false;
    while (running) {
      try (Connection connection = connectionFactory.open()) {
        try (Statement statement = connection.createStatement()) {
          statement.execute("LISTEN " + CHANNEL);
        }
        if (connectedBefore) hub.resync();
        connectedBefore = true;
        backoff = initialBackoff;
        PGConnection postgres = connection.unwrap(PGConnection.class);
        while (running) {
          PGNotification[] notifications = postgres.getNotifications(POLL_TIMEOUT_MILLIS);
          if (notifications == null) continue;
          for (PGNotification notification : notifications) {
            hub.onNotification(notification.getParameter());
          }
        }
      } catch (Exception exception) {
        if (!running) return;
        log.warn(
            "Generation notification listener disconnected; retrying in {}", backoff, exception);
        if (!sleep(backoff)) return;
        backoff =
            backoff.multipliedBy(2).compareTo(maxBackoff) > 0
                ? maxBackoff
                : backoff.multipliedBy(2);
      }
    }
  }

  private boolean sleep(Duration duration) {
    try {
      Thread.sleep(duration.toMillis());
      return true;
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      return false;
    }
  }

  private static Connection open(DataSourceProperties properties) throws SQLException {
    Properties connectionProperties = new Properties();
    if (properties.getUsername() != null)
      connectionProperties.setProperty("user", properties.getUsername());
    if (properties.getPassword() != null)
      connectionProperties.setProperty("password", properties.getPassword());
    connectionProperties.setProperty("tcpKeepAlive", "true");
    connectionProperties.setProperty("ApplicationName", "narrativex-generation-listener");
    return DriverManager.getConnection(properties.determineUrl(), connectionProperties);
  }
}
