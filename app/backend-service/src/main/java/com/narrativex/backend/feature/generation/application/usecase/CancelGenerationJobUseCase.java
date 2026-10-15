package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
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
  private final GenerationJobTransactionService transactions;

  @org.springframework.beans.factory.annotation.Autowired(required = false)
  private com.narrativex.backend.feature.generation.application.port.out
          .ChapterAnalysisExecutionStore
      localAnalyses;

  @org.springframework.beans.factory.annotation.Autowired(required = false)
  private com.narrativex.backend.feature.generation.application.service.ChapterVideoBatchService
      batches;

  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
  public GenerationJob execute(java.util.UUID jobId) {
    GenerationJob job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new ResourceNotFoundException("Generation job not found"));
    if (isTerminal(job.getStatus())) return job;
    if (job.isChapterVideoBatch()) return batches.cancel(jobId);

    GenerationJob pending = transactions.requestCancellation(jobId);
    if (pending.getStatus().isTerminal()) return pending;
    if (localAnalyses != null
        && localAnalyses
            .findSnapshot(job.getId())
            .filter(
                s ->
                    s.profile().executionMode()
                        != com.narrativex.backend.feature.generation.domain.enums
                            .ChapterAnalysisExecutionMode.VERTEX_API)
            .isPresent()) {
      return pending; // Electron observes cancellation; the GPU worker does not own this task.
    }
    try {
      var observation = executionPort.cancelTask(pending.getJobId(), pending.getComputeAttemptId());
      if (observation.isPresent()
          && observation.get().isCanceled()
          && pending.getJobId().equals(observation.get().taskId())
          && pending.getComputeAttemptId().equals(observation.get().attemptId())) {
        return transactions.markCanceled(
            jobId, "COMPUTE_CANCELED", "Worker confirmed cancellation");
      }
    } catch (RuntimeException exception) {
      // Intent and recovery schedule are already durable; reconciliation owns the outcome.
    }
    return generationJobRepository.findByJobId(jobId).orElse(pending);
  }

  private static boolean isTerminal(JobStatus status) {
    return status == JobStatus.COMPLETED
        || status == JobStatus.FAILED
        || status == JobStatus.CANCELED;
  }
}
