package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Coordinates durable job cancellation with the compute plane. */
@Service
@RequiredArgsConstructor
public class CancelGenerationJobUseCase {
  private final GenerationJobRepository generationJobRepository;
  private final GenerationExecutionPort executionPort;

  @Transactional
  public GenerationJob execute(java.util.UUID jobId) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new ResourceNotFoundException("Generation job not found"));
    if (isTerminal(job.getStatus())) return job;

    if (job.getStatus() != JobStatus.QUEUED) {
      try {
        executionPort.cancelTask(
            job.getJobId(), ComputeAttemptIdentity.forJob(job.getJobId(), job.getType()));
      } catch (RuntimeException exception) {
        GenerationJob unknown =
            job.markUnknown("COMPUTE_CANCEL_OUTCOME_UNKNOWN", "Cancellation outcome is unknown");
        return generationJobRepository.save(unknown);
      }
    }

    return generationJobRepository.save(
        job.markCanceled("COMPUTE_CANCELED", "Generation job canceled by request"));
  }

  private static boolean isTerminal(JobStatus status) {
    return status == JobStatus.COMPLETED
        || status == JobStatus.FAILED
        || status == JobStatus.CANCELED;
  }
}
