package com.narrativex.backend.feature.generation.infrastructure.reconciliation;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizer;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizerRegistry;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.service.GenerationJobStateMachine;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Executes bounded, non-blocking scheduled reconciliation queries against the compute worker.
 * Reconciles lost or delayed callbacks without blocking HTTP or worker threads.
 */
@Slf4j
@Service
public class ComputeReconciliationService {

  public enum ReconciliationResult {
    JOB_NOT_FOUND,
    ALREADY_TERMINAL,
    NOT_ELIGIBLE,
    WORKER_UNAVAILABLE,
    STALE_SEQUENCE,
    RECONCILED_RUNNING,
    RECONCILED_TERMINAL
  }

  private final GenerationJobRepository jobRepository;
  private final GenerationExecutionPort executionPort;
  private final ComputeResultFinalizerRegistry finalizerRegistry;
  private final ReconciliationBackoffPolicy backoffPolicy;
  private final GenerationJobEventBroadcaster eventBroadcaster;
  private final Clock clock;

  @org.springframework.beans.factory.annotation.Autowired
  public ComputeReconciliationService(
      GenerationJobRepository jobRepository,
      GenerationExecutionPort executionPort,
      ComputeResultFinalizerRegistry finalizerRegistry,
      ReconciliationBackoffPolicy backoffPolicy,
      GenerationJobEventBroadcaster eventBroadcaster) {
    this(
        jobRepository,
        executionPort,
        finalizerRegistry,
        backoffPolicy,
        eventBroadcaster,
        Clock.systemUTC());
  }

  ComputeReconciliationService(
      GenerationJobRepository jobRepository,
      GenerationExecutionPort executionPort,
      ComputeResultFinalizerRegistry finalizerRegistry,
      ReconciliationBackoffPolicy backoffPolicy,
      GenerationJobEventBroadcaster eventBroadcaster,
      Clock clock) {
    this.jobRepository = jobRepository;
    this.executionPort = executionPort;
    this.finalizerRegistry = finalizerRegistry;
    this.backoffPolicy = backoffPolicy;
    this.eventBroadcaster = eventBroadcaster;
    this.clock = clock;
  }

  public ReconciliationResult reconcileOnce(UUID jobId) {
    Optional<GenerationJob> jobOpt = jobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) {
      log.debug("Reconciliation skipped: job {} not found", jobId);
      return ReconciliationResult.JOB_NOT_FOUND;
    }

    GenerationJob job = jobOpt.get();
    if (job.getStatus().isTerminal()) {
      log.debug("Reconciliation skipped: job {} already terminal ({})", jobId, job.getStatus());
      return ReconciliationResult.ALREADY_TERMINAL;
    }

    UUID taskId = job.getJobId();
    UUID attemptId = job.getComputeAttemptId();
    if (attemptId == null) {
      log.warn("Reconciliation skipped: job {} has no computeAttemptId", jobId);
      return ReconciliationResult.NOT_ELIGIBLE;
    }

    Instant now = clock.instant();

    // Query worker - external I/O outside DB transaction
    ComputeObservationDto observation;
    try {
      observation = executionPort.queryTask(taskId, attemptId);
    } catch (Exception ex) {
      log.warn(
          "Worker query failed during reconciliation for job {} (attempt {}): {}",
          jobId,
          attemptId,
          ex.getMessage());
      int nextAttempts = job.getReconcileAttemptCount() + 1;
      Instant nextReconcileAt = backoffPolicy.calculateNextReconcileAt(now, nextAttempts);
      GenerationJob updated = job.recordReconciliationAttempt(nextReconcileAt, now);
      if (job.getStatus() == JobStatus.SUBMITTED && nextAttempts >= 3) {
        updated =
            updated.markUnknown(
                "WORKER_UNREACHABLE", "RECONCILIATION_UNREACHABLE", nextReconcileAt);
      }
      jobRepository.save(updated);
      return ReconciliationResult.WORKER_UNAVAILABLE;
    }

    if (observation == null) {
      log.warn("Worker returned null observation for job {} (attempt {})", jobId, attemptId);
      int nextAttempts = job.getReconcileAttemptCount() + 1;
      Instant nextReconcileAt = backoffPolicy.calculateNextReconcileAt(now, nextAttempts);
      GenerationJob updated = job.recordReconciliationAttempt(nextReconcileAt, now);
      jobRepository.save(updated);
      return ReconciliationResult.WORKER_UNAVAILABLE;
    }

    if (!taskId.equals(observation.taskId()) || !attemptId.equals(observation.attemptId())) {
      log.warn(
          "Worker observation identity mismatch: expected ({}, {}), got ({}, {})",
          taskId,
          attemptId,
          observation.taskId(),
          observation.attemptId());
      int nextAttempts = job.getReconcileAttemptCount() + 1;
      Instant nextReconcileAt = backoffPolicy.calculateNextReconcileAt(now, nextAttempts);
      GenerationJob updated = job.recordReconciliationAttempt(nextReconcileAt, now);
      jobRepository.save(updated);
      return ReconciliationResult.WORKER_UNAVAILABLE;
    }

    if (GenerationJobStateMachine.isStaleSequence(job, (long) observation.sequence())) {
      log.warn(
          "Reconciliation observed stale sequence {} for job {} (current sequence {})",
          observation.sequence(),
          jobId,
          job.getComputeSequence());
      int nextAttempts = job.getReconcileAttemptCount() + 1;
      Instant nextReconcileAt = backoffPolicy.calculateNextReconcileAt(now, nextAttempts);
      GenerationJob updated = job.recordReconciliationAttempt(nextReconcileAt, now);
      jobRepository.save(updated);
      return ReconciliationResult.STALE_SEQUENCE;
    }

    return processObservation(job, observation, now);
  }

  private ReconciliationResult processObservation(
      GenerationJob job, ComputeObservationDto observation, Instant now) {
    String state = observation.state() != null ? observation.state().toUpperCase() : "";

    switch (state) {
      case "SUCCEEDED" -> {
        Optional<ComputeResultFinalizer> finalizerOpt =
            finalizerRegistry.findFinalizer(job.getType());
        if (finalizerOpt.isPresent()) {
          finalizerOpt.get().finalizeResult(job, observation);
        } else {
          log.warn(
              "No finalizer found for JobType {}; marking completed directly during reconciliation",
              job.getType());
          GenerationJob completed = job.markCompleted("RECONCILIATION_COMPLETED");
          jobRepository.save(completed);
        }
        GenerationJob finalJob = jobRepository.findByJobId(job.getJobId()).orElse(job);
        eventBroadcaster.broadcastJobEvent(finalJob);
        return ReconciliationResult.RECONCILED_TERMINAL;
      }
      case "FAILED" -> {
        String code =
            observation.error() != null && observation.error().code() != null
                ? observation.error().code()
                : "COMPUTE_FAILED";
        String message =
            observation.error() != null && observation.error().message() != null
                ? observation.error().message()
                : "Compute execution failed";
        GenerationJob failed = job.markFailed(code, message);
        jobRepository.save(failed);
        eventBroadcaster.broadcastJobEvent(failed);
        return ReconciliationResult.RECONCILED_TERMINAL;
      }
      case "CANCELED" -> {
        GenerationJob canceled = job.markCanceled("USER_CANCELED", "RECONCILIATION_CANCELED");
        jobRepository.save(canceled);
        eventBroadcaster.broadcastJobEvent(canceled);
        return ReconciliationResult.RECONCILED_TERMINAL;
      }
      case "RUNNING" -> {
        int progress =
            observation.progress() != null ? (int) Math.round(observation.progress() * 100) : 30;
        int nextAttempts = job.getReconcileAttemptCount() + 1;
        Instant nextReconcileAt = backoffPolicy.calculateNextReconcileAt(now, nextAttempts);
        GenerationJob running =
            job.markRunningWithCompute(
                "COMPUTING_MEDIA",
                progress,
                (long) observation.sequence(),
                observation.state(),
                observation.executionHandle());
        running = running.recordReconciliationAttempt(nextReconcileAt, now);
        jobRepository.save(running);
        eventBroadcaster.broadcastJobEvent(running);
        return ReconciliationResult.RECONCILED_RUNNING;
      }
      default -> {
        int nextAttempts = job.getReconcileAttemptCount() + 1;
        Instant nextReconcileAt = backoffPolicy.calculateNextReconcileAt(now, nextAttempts);
        GenerationJob updated = job.recordReconciliationAttempt(nextReconcileAt, now);
        jobRepository.save(updated);
        return ReconciliationResult.RECONCILED_RUNNING;
      }
    }
  }
}
