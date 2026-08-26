package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class PostgresGenerationHintPublisherTest {
  @Test
  void publishesOnlyTheOutboxIdAsWakeupPayload() throws Exception {
    DataSource dataSource = mock(DataSource.class);
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.prepareStatement("SELECT pg_notify(?, ?)")).thenReturn(statement);

    new PostgresGenerationHintPublisher(dataSource).publish("narrativex_generation_jobs", 42L);

    verify(statement).setString(1, "narrativex_generation_jobs");
    verify(statement).setString(2, "42");
    verify(statement).execute();
    verify(statement).close();
    verify(connection).close();
  }
}
