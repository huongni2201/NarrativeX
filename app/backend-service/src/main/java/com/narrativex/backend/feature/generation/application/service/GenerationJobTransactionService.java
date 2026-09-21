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
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.SUBMITTING)) {
      log.debug("Job {} is in state {}, cannot transition to SUBMITTING", jobId, job.getStatus());
      return Optional.empty();
    }
    GenerationJob submitting = job.markSubmitting(step);
    return Optional.of(generationJobRepository.save(submitting));
  }

  @Transactional
  public Optional<GenerationJob> claimForRunning(UUID jobId, String step, int progress) {
    Optional<GenerationJob> jobOpt = generationJobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) {
      log.debug("Job {} not found for execution claim", jobId);
      return Optional.empty();
    }
    GenerationJob job = jobOpt.get();
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.RUNNING)) {
      log.debug("Job {} is in state {}, cannot transition to RUNNING", jobId, job.getStatus());
      return Optional.empty();
    }
    GenerationJob running = job.markRunning(step, progress);
    return Optional.of(generationJobRepository.save(running));
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
  public GenerationJob markSubmissionFailed(UUID jobId, String errorCode, String message) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.FAILED)) {
      log.warn("Cannot transition job {} from {} to FAILED", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(job.markFailed(errorCode, message));
  }

  @Transactional
  public GenerationJob markSubmissionUnknown(
      UUID jobId, String errorCode, String message, Instant nextReconcileAt) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new IllegalStateException("Job " + jobId + " disappeared"));
    if (!GenerationJobStateMachine.canTransition(job.getStatus(), JobStatus.UNKNOWN)) {
      log.warn("Cannot transition job {} from {} to UNKNOWN", jobId, job.getStatus());
      return job;
    }
    return generationJobRepository.save(job.markUnknown(errorCode, message, nextReconcileAt));
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
