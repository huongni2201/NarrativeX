package com.narrativex.backend.feature.generation.infrastructure.realtime;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.port.in.GenerationEventStream;
import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.postgresql.PGConnection;
import tools.jackson.databind.ObjectMapper;

class GenerationDatabaseEventListenerTest {

  @Test
  void nonPostgresDatasourceStopsWithoutUnwrapListenOrRetry() throws Exception {
    DataSource dataSource = mock(DataSource.class);
    Connection connection = mock(Connection.class);
    Statement statement = mock(Statement.class);
    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.createStatement()).thenReturn(statement);
    when(connection.isWrapperFor(PGConnection.class)).thenReturn(false);

    GenerationDatabaseEventListener listener =
        new GenerationDatabaseEventListener(
            dataSource, mock(ObjectMapper.class), mock(GenerationEventStream.class));

    try {
      listener.start();
      verify(connection, timeout(500)).isWrapperFor(PGConnection.class);
      verify(connection, never()).unwrap(PGConnection.class);
      verify(statement, never()).execute("LISTEN narrativex_generation_events");
    } finally {
      listener.stop();
    }
  }
}
