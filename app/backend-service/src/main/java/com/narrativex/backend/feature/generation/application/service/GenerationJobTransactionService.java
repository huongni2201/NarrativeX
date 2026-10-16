package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.service.GenerationJobStateMachine;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service providing short, isolated database transaction boundaries for GenerationJob lifecycle.
 * Remote calls to external engines (Gemini, GPU worker) must occur outside these transaction
 * methods.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationJobTransactionService {
  private final GenerationJobRepository generationJobRepository;

  @Transactional
  public Optional<GenerationJob> claimForSubmission(UUID jobId, String step) {
    Optional<GenerationJob> jobOpt = generationJobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) {
      log.debug("Job {} not found for submission claim", jobId);
      return Optional.empty();
    }
    GenerationJob job = jobOpt.get();
    if (job.isChapterVideoBatch()) return Optional.empty();
    if (job.getType()
            == com.narrativex.backend.feature.generation.domain.enums.JobType.CHAPTER_GENERATE
        && (job.getResourceClass()
                == com.narrativex.backend.feature.generation.domain.enums.ResourceClass.GPU_HEAVY
            || job.getProductionMode()
                == com.narrativex.backend.feature.generation.domain.enums.ProductionMode
                    .VIDEO_FIRST)) {
      generationJobRepository.acquireAnalysisCapacityLock();
      if (generationJobRepository.countActiveVideoExecutions() > 0
          && job.getStatus() == JobStatus.QUEUED) {
        throw new com.narrativex.backend.feature.generation.domain.exception
            .GenerationAdmissionDeniedException(
            "GPU_CAPACITY", "Video execution slot is occupied; queued intent remains pending");
      }
    }
    if (job.getStatus() != JobStatus.QUEUED) {
      log.debug("Job {} is in state {}, cannot transition to SUBMITTING", jobId, job.getStatus());
      return Optional.empty();
    }
    GenerationJob submitting =
        job.markSubmitting(step).toBuilder()
            .computeAttemptId(
                job.getComputeAttemptId() != null
                    ? job.getComputeAttemptId()
                    : ComputeAttemptIdentity.forJob(job.getJobId(), job.getType()))
            .nextReconcileAt(Instant.now().plusSeconds(30))
            .build();
    return Optional.of(generationJobRepository.save(submitting));
  }

  /** Commit cancellation intent before remote I/O and retain ambiguous execution capacity. */
  @Transactional
  public GenerationJob requestCancellation(UUID jobId) {
    generationJobRepository.acquireAnalysisCapacityLock();
    var job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Generation job disappeared"));
    if (job.getStatus().isTerminal()) return job;
    if (job.getStatus() == JobStatus.QUEUED) {
      return generationJobRepository.save(
          job.markCanceled("COMPUTE_CANCELED", "Canceled before submission"));
    }
    var pending =
        job
            .markUnknown("COMPUTE_CANCEL_REQUESTED", "Awaiting cancellation outcome", Instant.now())
            .toBuilder()
            .computeAttemptId(
                job.getComputeAttemptId() != null
                    ? job.getComputeAttemptId()
                    : ComputeAttemptIdentity.forJob(job.getJobId(), job.getType()))
            .build();
    return generationJobRepository.save(pending);
  }

  @Transactional
  public Optional<GenerationJob> claimForRunning(UUID jobId, String step, int progress) {
    Optional<GenerationJob> jobOpt = generationJobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) {
      log.debug("Job {} not found for execution claim", jobId);
      return Optional.empty();
    }
    GenerationJob job = jobOpt.get();
    if (job.isChapterVideoBatch()) return Optional.empty();
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.RUNNING)) {
      log.debug("Job {} is in state {}, cannot transition to RUNNING", jobId, job.getStatus());
      return Optional.empty();
    }
    GenerationJob running = job.markRunning(step, progress);
    return Optional.of(generationJobRepository.save(running));
  }

  /**
   * Raises the progress of a RUNNING job. It never lowers it, never reaches 100 (only completion
   * does) and writes nothing when the value would not change, so a chatty reporter cannot churn the
   * row or its change events.
   */
  @Transactional
  public Optional<GenerationJob> recordProgress(UUID jobId, int progress) {
    Optional<GenerationJob> jobOpt = generationJobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) return Optional.empty();
    GenerationJob job = jobOpt.get();
    if (job.getStatus() != JobStatus.RUNNING || job.isCancellationRequested())
      return Optional.empty();
    GenerationJob advanced = job.recordComputeProgress(progress, null, null);
    if (advanced.getProgress() == job.getProgress()) return Optional.of(job);
    return Optional.of(generationJobRepository.save(advanced));
  }

  @Transactional
  public GenerationJob markSubmitted(
      UUID jobId, ComputeSubmissionReceipt receipt, Instant nextReconcileAt) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.SUBMITTED)) {
      log.warn("Cannot transition job {} from {} to SUBMITTED", jobId, job.getStatus());
      return job;
    }
    if (job.getComputeAttemptId() != null
        && (!job.getJobId().equals(receipt.taskId())
            || !job.getComputeAttemptId().equals(receipt.attemptId()))) {
      throw new IllegalArgumentException(
          "Compute receipt does not match the admitted task/attempt");
    }
    GenerationJob submitted =
        job.markSubmitted(
            receipt.attemptId(),
            receipt.executionHandle(),
            receipt.sequence(),
            Instant.now(),
            nextReconcileAt);
    return generationJobRepository.save(submitted);
  }

  @Transactional
  public GenerationJob markSubmissionFailed(UUID jobId, String errorCode, String step) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.FAILED)) {
      log.warn("Cannot transition job {} from {} to FAILED", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(job.markFailed(errorCode, step));
  }

  /**
   * Returns a job whose attempt failed without output to the queue; a later claim starts a new
   * attempt.
   */
  @Transactional
  public GenerationJob markRequeued(UUID jobId, String reason) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (job.getStatus() == JobStatus.QUEUED) return job;
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.QUEUED)) {
      log.warn("Cannot transition job {} from {} to QUEUED", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(job.markQueued("REQUEUED_" + reason));
  }

  @Transactional
  public GenerationJob markSubmissionUnknown(
      UUID jobId, String errorCode, String step, Instant nextReconcileAt) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.UNKNOWN)) {
      log.warn("Cannot transition job {} from {} to UNKNOWN", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(
        job.markUnknown(
            job.isCancellationRequested() ? GenerationJob.CANCEL_REQUESTED_CODE : errorCode,
            step,
            nextReconcileAt));
  }

  @Transactional
  public GenerationJob completeAnalysis(UUID jobId, Runnable materialization) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.COMPLETED)) {
      return job;
    }
    materialization.run();
    return markCompleted(jobId, "STORYBOARD_READY");
  }

  @Transactional
  public GenerationJob markCompleted(UUID jobId, String step) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.COMPLETED)) {
      log.warn("Cannot transition job {} from {} to COMPLETED", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(job.markCompleted(step));
  }

  @Transactional
  public GenerationJob markCanceled(UUID jobId, String errorCode, String message) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.CANCELED)) {
      log.warn("Cannot transition job {} from {} to CANCELED", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(job.markCanceled(errorCode, message));
  }
}
