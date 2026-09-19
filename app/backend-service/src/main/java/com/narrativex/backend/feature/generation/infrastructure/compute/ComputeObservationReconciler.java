package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * Legacy blocking polling helper; deprecated in favor of ADR-0025 event-driven callbacks and
 * scheduled non-blocking reconciliation via {@link ComputeReconciliationService}.
 */
@Deprecated(since = "ADR-0025", forRemoval = true)
@Slf4j
public final class ComputeObservationReconciler {
  @FunctionalInterface
  interface Sleeper {
    void sleep(Duration duration) throws InterruptedException;
  }

  private final GenerationExecutionPort executionPort;
  private final Duration timeout;
  private final Duration pollInterval;
  private final Clock clock;
  private final Sleeper sleeper;

  public ComputeObservationReconciler(
      GenerationExecutionPort executionPort, Duration timeout, Duration pollInterval) {
    this(
        executionPort,
        timeout,
        pollInterval,
        Clock.systemUTC(),
        duration -> Thread.sleep(duration.toMillis()));
  }

  ComputeObservationReconciler(
      GenerationExecutionPort executionPort,
      Duration timeout,
      Duration pollInterval,
      Clock clock,
      Sleeper sleeper) {
    if (timeout.isNegative() || timeout.isZero()) {
      throw new IllegalArgumentException("reconciliation timeout must be positive");
    }
    if (pollInterval.isNegative()) {
      throw new IllegalArgumentException("reconciliation poll interval must not be negative");
    }
    this.executionPort = executionPort;
    this.timeout = timeout;
    this.pollInterval = pollInterval;
    this.clock = clock;
    this.sleeper = sleeper;
  }

  public ComputeObservationDto reconcile(UUID taskId, UUID attemptId) {
    Instant deadline = clock.instant().plus(timeout);
    while (true) {
      ComputeObservationDto observation;
      try {
        observation = executionPort.queryTask(taskId, attemptId);
      } catch (RuntimeException exception) {
        log.warn(
            "Compute observation query failed; keeping task outcome ambiguous taskId={} attemptId={}",
            taskId,
            attemptId);
        return null;
      }

      if (observation == null) {
        return null;
      }
      if (!taskId.equals(observation.taskId()) || !attemptId.equals(observation.attemptId())) {
        log.warn(
            "Compute observation identity mismatch; keeping task outcome ambiguous taskId={} attemptId={}",
            taskId,
            attemptId);
        return null;
      }
      if (observation.isTerminal()) {
        return observation;
      }
      if (!clock.instant().isBefore(deadline)) {
        return null;
      }
      try {
        sleeper.sleep(pollInterval);
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
        return null;
      }
    }
  }
}
