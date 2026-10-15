package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OutboxDispatchRow;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.time.Instant;
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
 *
 * <p>Two modes share the same outbox table. The sequential mode dispatches one row at a time on the
 * scheduler thread. When {@code narrativex.generation.dispatch.parallel-enabled} is true, rows are
 * reserved per {@link DispatchLane} and handed to {@link GenerationDispatchExecutor}, so a slow
 * analysis call can no longer delay unrelated jobs.
 */
@Slf4j
@Component
@ConditionalOnProperty(
    name = "narrativex.generation.outbox-dispatch-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class GenerationOutboxDispatcher {
  private static final long RESERVATION_MILLIS = Duration.ofSeconds(30).toMillis();
  private static final String NO_ANALYSIS_TYPE = "__NONE__";

  private final GenerationOutboxMapper mapper;
  private final TransactionTemplate transactionTemplate;
  private final ComputeExecutionDispatcher executionDispatcher;

  @Autowired(required = false)
  private com.narrativex.backend.feature.generation.application.service.ChapterVideoBatchService
      batches;

  @Autowired(required = false)
  private GenerationDispatchProperties properties;

  @Autowired(required = false)
  private GenerationDispatchExecutor laneExecutor;

  @Autowired(required = false)
  private GenerationJobHandlerRegistry handlerRegistry;

  @Autowired(required = false)
  private MeterRegistry meterRegistry;

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

  /** Enables the lane-based path; used by tests that build the dispatcher by hand. */
  GenerationOutboxDispatcher withLanes(
      GenerationDispatchProperties properties,
      GenerationDispatchExecutor laneExecutor,
      GenerationJobHandlerRegistry handlerRegistry,
      MeterRegistry meterRegistry) {
    this.properties = properties;
    this.laneExecutor = laneExecutor;
    this.handlerRegistry = handlerRegistry;
    this.meterRegistry = meterRegistry;
    return this;
  }

  @Scheduled(fixedDelayString = "${narrativex.generation.outbox-dispatch-delay-ms:1000}")
  public void dispatchPending() {
    if (parallelEnabled()) {
      dispatchParallel();
      return;
    }
    if (batches != null) batches.resumePending();
    for (OutboxDispatchRow row : reserveBatch()) {
      try {
        if (executionDispatcher != null && row.getAggregateId() != null) {
          recordDispatchLatency(row);
          executionDispatcher.dispatchJob(UUID.fromString(row.getAggregateId()));
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

  private boolean parallelEnabled() {
    return properties != null
        && properties.isParallelEnabled()
        && laneExecutor != null
        && handlerRegistry != null
        && executionDispatcher != null;
  }

  private void dispatchParallel() {
    int analysisFree = laneExecutor.availablePermits(DispatchLane.ANALYSIS);
    int mediaFree = laneExecutor.availablePermits(DispatchLane.MEDIA);
    if (analysisFree + mediaFree == 0) {
      return;
    }
    List<String> analysisTypes = handlerRegistry.jobTypeNamesInLane(DispatchLane.ANALYSIS);
    List<String> classifier = analysisTypes.isEmpty() ? List.of(NO_ANALYSIS_TYPE) : analysisTypes;
    long reservationMillis = properties.getReservation().toMillis();
    List<OutboxDispatchRow> rows =
        transactionTemplate.execute(
            ignored ->
                mapper.reserveLaneBatch(reservationMillis, analysisFree, mediaFree, classifier));
    if (rows == null) {
      return;
    }
    for (OutboxDispatchRow row : rows) {
      DispatchLane lane =
          DispatchLane.ANALYSIS.name().equals(row.getLane())
              ? DispatchLane.ANALYSIS
              : DispatchLane.MEDIA;
      long leaseMillis = properties.lease(lane).toMillis();
      if (laneExecutor.isInFlight(row.getId())) {
        // The row's reservation lapsed while its handler is still running; keep it leased.
        extendQuietly(row.getId(), leaseMillis);
        continue;
      }
      // A rejected row keeps only its short reservation and is picked up again on a later tick.
      laneExecutor.trySubmit(lane, row.getId(), () -> runReserved(row, leaseMillis));
    }
  }

  private void runReserved(OutboxDispatchRow row, long leaseMillis) {
    extendQuietly(row.getId(), leaseMillis);
    try {
      if (row.getAggregateId() != null) {
        recordDispatchLatency(row);
        executionDispatcher.dispatchJob(UUID.fromString(row.getAggregateId()));
      }
      int updated = mapper.markPublished(row.getId());
      if (updated == 0) {
        log.debug("Outbox event {} was already finalized or is no longer pending", row.getId());
      }
    } catch (RuntimeException exception) {
      // Return the row to the short retry window instead of holding the long handler lease, so a
      // denied admission (for example an occupied GPU slot) is retried promptly.
      extendQuietly(row.getId(), properties.getReservation().toMillis());
      log.warn(
          "Outbox dispatch failed for event {}; it will be retried after the reservation timeout",
          row.getId(),
          exception);
    }
  }

  private void extendQuietly(long id, long leaseMillis) {
    try {
      mapper.extendReservation(id, leaseMillis);
    } catch (RuntimeException exception) {
      log.warn("Could not extend outbox reservation for event {}", id, exception);
    }
  }

  private void recordDispatchLatency(OutboxDispatchRow row) {
    if (meterRegistry == null || row.getCreatedAt() == null) {
      return;
    }
    Duration latency = Duration.between(row.getCreatedAt(), Instant.now());
    if (latency.isNegative()) {
      latency = Duration.ZERO;
    }
    Timer.builder("narrativex.outbox.dispatch.latency")
        .description("Time from outbox row creation until its handler starts")
        .register(meterRegistry)
        .record(latency);
  }

  private List<OutboxDispatchRow> reserveBatch() {
    List<OutboxDispatchRow> rows =
        transactionTemplate.execute(ignored -> mapper.reserveBatch(RESERVATION_MILLIS));
    return rows == null ? List.of() : rows;
  }
}
