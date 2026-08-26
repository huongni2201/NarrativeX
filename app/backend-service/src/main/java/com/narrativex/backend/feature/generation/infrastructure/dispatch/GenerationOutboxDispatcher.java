package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OutboxDispatchRow;
import java.time.Duration;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Best-effort PostgreSQL wake-up hint for durable generation jobs. PostgreSQL tables remain the
 * authoritative queue; workers always discover queued work by polling even when NOTIFY is missed.
 */
@Slf4j
@Component
@ConditionalOnProperty(
    name = "narrativex.generation.outbox-dispatch-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class GenerationOutboxDispatcher {
  static final String CHANNEL = "narrativex_generation_jobs";
  static final String MEDIA_VALIDATION_CHANNEL = "narrativex_media_validation_jobs";
  private static final long RESERVATION_MILLIS = Duration.ofSeconds(30).toMillis();
  private static final long RETRY_MILLIS = Duration.ofSeconds(5).toMillis();

  private final GenerationOutboxMapper mapper;
  private final PostgresGenerationHintPublisher hintPublisher;
  private final TransactionTemplate transactionTemplate;

  public GenerationOutboxDispatcher(
      GenerationOutboxMapper mapper,
      PostgresGenerationHintPublisher hintPublisher,
      PlatformTransactionManager transactionManager) {
    this.mapper = mapper;
    this.hintPublisher = hintPublisher;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  @Scheduled(fixedDelayString = "${narrativex.generation.outbox-dispatch-delay-ms:1000}")
  public void dispatchPending() {
    for (OutboxRow row : reserveBatch()) {
      try {
        hintPublisher.publish(row.channel(), row.id());
        mapper.markPublished(row.id());
      } catch (RuntimeException exception) {
        log.warn(
            "PostgreSQL generation hint failed for outbox event {}; durable worker polling remains active",
            row.id());
        mapper.scheduleRetry(row.id(), RETRY_MILLIS);
      }
    }
  }

  private List<OutboxRow> reserveBatch() {
    List<OutboxRow> rows =
        transactionTemplate.execute(
            ignored ->
                mapper.reserveBatch(RESERVATION_MILLIS).stream()
                    .map(GenerationOutboxDispatcher::mapRow)
                    .toList());
    return rows == null ? List.of() : rows;
  }

  private static OutboxRow mapRow(OutboxDispatchRow row) {
    return new OutboxRow(
        row.getId(),
        "MEDIA_VALIDATION_REQUESTED".equals(row.getEventType())
            ? MEDIA_VALIDATION_CHANNEL
            : CHANNEL);
  }

  private record OutboxRow(long id, String channel) {}
}
