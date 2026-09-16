package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OutboxDispatchRow;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Finalizes transactional generation/media-validation outbox records after commit and dispatches
 * them to the compute execution plane.
 */
@Slf4j
@Component
@ConditionalOnProperty(
    name = "narrativex.generation.outbox-dispatch-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class GenerationOutboxDispatcher {
  private static final long RESERVATION_MILLIS = Duration.ofSeconds(30).toMillis();

  private final GenerationOutboxMapper mapper;
  private final TransactionTemplate transactionTemplate;
  private final ComputeExecutionDispatcher executionDispatcher;

  public GenerationOutboxDispatcher(
      GenerationOutboxMapper mapper, PlatformTransactionManager transactionManager) {
    this(mapper, transactionManager, null);
  }

  @Autowired
  public GenerationOutboxDispatcher(
      GenerationOutboxMapper mapper,
      PlatformTransactionManager transactionManager,
      @Autowired(required = false) ComputeExecutionDispatcher executionDispatcher) {
    this.mapper = mapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.executionDispatcher = executionDispatcher;
  }

  @Scheduled(fixedDelayString = "${narrativex.generation.outbox-dispatch-delay-ms:1000}")
  public void dispatchPending() {
    for (OutboxDispatchRow row : reserveBatch()) {
      try {
        if (executionDispatcher != null && row.getAggregateId() != null) {
          try {
            executionDispatcher.dispatchJob(UUID.fromString(row.getAggregateId()));
          } catch (Exception e) {
            log.warn(
                "Failed to dispatch execution job for outbox row {}: {}",
                row.getId(),
                e.getMessage());
          }
        }
        int updated = mapper.markPublished(row.getId());
        if (updated == 0) {
          log.debug("Outbox event {} was already finalized or is no longer pending", row.getId());
        }
      } catch (RuntimeException exception) {
        log.warn(
            "Outbox acknowledgement failed for event {}; it will be retried after the reservation timeout",
            row.getId(),
            exception);
      }
    }
  }

  private List<OutboxDispatchRow> reserveBatch() {
    List<OutboxDispatchRow> rows =
        transactionTemplate.execute(ignored -> mapper.reserveBatch(RESERVATION_MILLIS));
    return rows == null ? List.of() : rows;
  }
}
