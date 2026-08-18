package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Best-effort Redis delivery hint for durable generation jobs. PostgreSQL remains authoritative: a
 * worker is always allowed to discover queued work by polling even when Redis is unavailable.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GenerationOutboxDispatcher {
  static final String CHANNEL = "narrativex:generation:jobs";

  private final JdbcTemplate jdbcTemplate;
  private final StringRedisTemplate redisTemplate;

  @Scheduled(fixedDelayString = "${narrativex.generation.outbox-dispatch-delay-ms:1000}")
  @Transactional
  public void dispatchPending() {
    List<OutboxRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, payload_json::text
              FROM outbox_events
             WHERE status = 'PENDING'
               AND event_type = 'GENERATION_JOB_QUEUED'
               AND available_at <= CURRENT_TIMESTAMP
             ORDER BY id
             LIMIT 50
             FOR UPDATE SKIP LOCKED
            """,
            GenerationOutboxDispatcher::mapRow);

    for (OutboxRow row : rows) {
      try {
        redisTemplate.convertAndSend(CHANNEL, row.payloadJson());
        jdbcTemplate.update(
            "UPDATE outbox_events SET status = 'PUBLISHED', attempts = attempts + 1 WHERE id = ?",
            row.id());
      } catch (RuntimeException exception) {
        log.warn("Redis generation hint failed for outbox event {}; PostgreSQL polling remains active", row.id());
        jdbcTemplate.update(
            """
            UPDATE outbox_events
               SET attempts = attempts + 1,
                   available_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 millisecond')
             WHERE id = ?
            """,
            Duration.ofSeconds(5).toMillis(),
            row.id());
      }
    }
  }

  private static OutboxRow mapRow(ResultSet resultSet, int rowNum) throws SQLException {
    return new OutboxRow(resultSet.getLong("id"), resultSet.getString("payload_json"));
  }

  private record OutboxRow(long id, String payloadJson) {}
}
