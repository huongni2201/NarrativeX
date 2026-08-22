package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Best-effort Redis delivery hint for durable generation jobs. PostgreSQL remains authoritative: a
 * worker is always allowed to discover queued work by polling even when Redis is unavailable.
 */
@Slf4j
@Component
@ConditionalOnProperty(
    name = "narrativex.generation.outbox-dispatch-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class GenerationOutboxDispatcher {
  static final String CHANNEL = "narrativex:generation:jobs";
  static final String MEDIA_VALIDATION_CHANNEL = "narrativex:media-validation:jobs";
  private static final long RESERVATION_MILLIS = Duration.ofSeconds(30).toMillis();
  private static final long RETRY_MILLIS = Duration.ofSeconds(5).toMillis();

  private final JdbcTemplate jdbcTemplate;
  private final StringRedisTemplate redisTemplate;
  private final TransactionTemplate transactionTemplate;

  public GenerationOutboxDispatcher(
      JdbcTemplate jdbcTemplate,
      StringRedisTemplate redisTemplate,
      PlatformTransactionManager transactionManager) {
    this.jdbcTemplate = jdbcTemplate;
    this.redisTemplate = redisTemplate;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  @Scheduled(fixedDelayString = "${narrativex.generation.outbox-dispatch-delay-ms:1000}")
  public void dispatchPending() {
    for (OutboxRow row : reserveBatch()) {
      try {
        redisTemplate.convertAndSend(row.channel(), row.payloadJson());
        jdbcTemplate.update(
            """
            UPDATE outbox_events
               SET status = 'PUBLISHED', attempts = attempts + 1
             WHERE id = ? AND status = 'PENDING'
            """,
            row.id());
      } catch (RuntimeException exception) {
        log.warn(
            "Redis generation hint failed for outbox event {}; PostgreSQL polling remains active",
            row.id());
        jdbcTemplate.update(
            """
            UPDATE outbox_events
               SET attempts = attempts + 1,
                   available_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 millisecond')
             WHERE id = ? AND status = 'PENDING'
            """,
            RETRY_MILLIS,
            row.id());
      }
    }
  }

  private List<OutboxRow> reserveBatch() {
    List<OutboxRow> rows =
        transactionTemplate.execute(
            ignored ->
                jdbcTemplate.query(
                    """
                    WITH candidates AS (
                        SELECT id
                          FROM outbox_events
                         WHERE status = 'PENDING'
                           AND event_type IN ('GENERATION_JOB_QUEUED', 'MEDIA_VALIDATION_REQUESTED')
                           AND available_at <= CURRENT_TIMESTAMP
                         ORDER BY id
                         LIMIT 50
                         FOR UPDATE SKIP LOCKED
                    )
                    UPDATE outbox_events event
                       SET available_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 millisecond')
                      FROM candidates
                     WHERE event.id = candidates.id
                    RETURNING event.id, event.event_type, event.payload_json::text
                    """,
                    GenerationOutboxDispatcher::mapRow,
                    RESERVATION_MILLIS));
    return rows == null ? List.of() : rows;
  }

  private static OutboxRow mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        String eventType = resultSet.getString("event_type");
        return new OutboxRow(
            resultSet.getLong("id"), resultSet.getString("payload_json"),
            "MEDIA_VALIDATION_REQUESTED".equals(eventType) ? MEDIA_VALIDATION_CHANNEL : CHANNEL);
  }

  private record OutboxRow(long id, String payloadJson, String channel) {}
}
