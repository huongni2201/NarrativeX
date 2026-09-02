package com.narrativex.backend.feature.generation.infrastructure.realtime;

import com.narrativex.backend.feature.generation.application.model.GenerationEvent;
import com.narrativex.backend.feature.generation.application.port.in.GenerationEventStream;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.Statement;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.sql.DataSource;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@ConditionalOnProperty(
    name = "narrativex.generation.sse.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class GenerationDatabaseEventListener {
  private static final Logger log = LoggerFactory.getLogger(GenerationDatabaseEventListener.class);
  private static final String CHANNEL = "narrativex_generation_events";

  private final DataSource dataSource;
  private final ObjectMapper objectMapper;
  private final GenerationEventStream generationEventStream;
  private final ExecutorService executor =
      Executors.newSingleThreadExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "generation-postgres-listener");
            thread.setDaemon(true);
            return thread;
          });
  private volatile boolean running;

  public GenerationDatabaseEventListener(
      DataSource dataSource,
      ObjectMapper objectMapper,
      GenerationEventStream generationEventStream) {
    this.dataSource = dataSource;
    this.objectMapper = objectMapper;
    this.generationEventStream = generationEventStream;
  }

  @PostConstruct
  void start() {
    running = true;
    executor.submit(this::listenUntilStopped);
  }

  @PreDestroy
  void stop() {
    running = false;
    executor.shutdownNow();
  }

  private void listenUntilStopped() {
    while (running) {
      try (Connection connection = dataSource.getConnection()) {
        if (!connection.isWrapperFor(PGConnection.class)) {
          log.info(
              "Generation PostgreSQL event listener disabled because the datasource is not PostgreSQL");
          running = false;
          return;
        }
        try (Statement statement = connection.createStatement()) {
          PGConnection postgresConnection = connection.unwrap(PGConnection.class);
          statement.execute("LISTEN " + CHANNEL);
          listenOnConnection(postgresConnection);
        }
      } catch (Exception exception) {
        if (running) {
          log.warn("Generation PostgreSQL event listener disconnected; retrying", exception);
          sleepBeforeRetry();
        }
      }
    }
  }

  private void listenOnConnection(PGConnection postgresConnection) throws Exception {
    while (running) {
      PGNotification[] notifications = postgresConnection.getNotifications(5_000);
      if (notifications == null || notifications.length == 0) {
        continue;
      }
      for (PGNotification notification : notifications) {
        publish(notification.getParameter());
      }
    }
  }

  private void publish(String payload) {
    try {
      generationEventStream.publish(objectMapper.readValue(payload, GenerationEvent.class));
    } catch (Exception exception) {
      log.warn("Ignoring invalid generation PostgreSQL event payload", exception);
    }
  }

  private void sleepBeforeRetry() {
    try {
      Thread.sleep(1_000);
    } catch (InterruptedException interruptedException) {
      Thread.currentThread().interrupt();
    }
  }
}
