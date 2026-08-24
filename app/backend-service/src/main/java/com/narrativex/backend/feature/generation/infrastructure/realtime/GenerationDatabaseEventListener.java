package com.narrativex.backend.feature.generation.infrastructure.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.event.GenerationRealtimeEvent;
import com.narrativex.backend.feature.generation.application.port.in.GenerationEventStream;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.Statement;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(
    name = "narrativex.generation.sse.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class GenerationDatabaseEventListener {
  private static final String CHANNEL = "narrativex_generation_events";

  private final DataSource dataSource;
  private final ObjectMapper objectMapper;
  private final GenerationEventStream streamService;
  private final ExecutorService executor =
      Executors.newSingleThreadExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "generation-postgres-events");
            thread.setDaemon(true);
            return thread;
          });

  private volatile boolean running;

  public GenerationDatabaseEventListener(
      DataSource dataSource, ObjectMapper objectMapper, GenerationEventStream streamService) {
    this.dataSource = dataSource;
    this.objectMapper = objectMapper;
    this.streamService = streamService;
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
      try (Connection connection = dataSource.getConnection();
          Statement statement = connection.createStatement()) {
        PGConnection postgresConnection = connection.unwrap(PGConnection.class);
        statement.execute("LISTEN " + CHANNEL);
        listenOnConnection(postgresConnection);
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
      PGNotification[] notifications = postgresConnection.getNotifications(1000);
      if (notifications == null) continue;
      for (PGNotification notification : notifications) publish(notification.getParameter());
    }
  }

  private void publish(String payload) {
    try {
      DatabaseGenerationEvent event =
          objectMapper.readValue(payload, DatabaseGenerationEvent.class);
      streamService.publish(
          new GenerationRealtimeEvent(
              event.eventId(), event.userId(), event.projectId(), event.job()));
    } catch (Exception exception) {
      log.warn("Ignoring malformed generation SSE event", exception);
    }
  }

  private void sleepBeforeRetry() {
    try {
      Thread.sleep(1000);
    } catch (InterruptedException interruptedException) {
      Thread.currentThread().interrupt();
    }
  }

  private record DatabaseGenerationEvent(
      String eventId, String userId, UUID projectId, JobResponse job) {}
}
