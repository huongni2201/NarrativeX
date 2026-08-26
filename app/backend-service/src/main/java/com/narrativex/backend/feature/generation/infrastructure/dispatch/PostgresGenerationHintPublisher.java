package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Best-effort PostgreSQL NOTIFY publisher. Durable job state remains in PostgreSQL tables. */
@Component
@RequiredArgsConstructor
public class PostgresGenerationHintPublisher {
  private final DataSource dataSource;

  public void publish(String channel, long outboxEventId) {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement("SELECT pg_notify(?, ?)")) {
      statement.setString(1, channel);
      statement.setString(2, Long.toString(outboxEventId));
      statement.execute();
    } catch (SQLException exception) {
      throw new IllegalStateException("PostgreSQL generation hint could not be published", exception);
    }
  }
}
