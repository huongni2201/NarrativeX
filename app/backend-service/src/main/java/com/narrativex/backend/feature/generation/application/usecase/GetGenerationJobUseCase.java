package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.value.AnalysisProgress;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetGenerationJobUseCase {
  private final GenerationJobRepository jobRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public GenerationJob execute(GetGenerationJobQuery query) {
    return jobRepository
        .findByJobIdAndOwner(query.jobId(), currentUserId.get())
        .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
  }

  @Transactional(readOnly = true)
  public JobDetails executeWithProgress(GetGenerationJobQuery query) {
    String ownerId = currentUserId.get();
    GenerationJob job =
        jobRepository
            .findByJobIdAndOwner(query.jobId(), ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    AnalysisProgress analysisProgress =
        jobRepository.findAnalysisProgressByJobIdAndOwner(query.jobId(), ownerId).orElse(null);
    return new JobDetails(job, analysisProgress);
  }

  public record JobDetails(GenerationJob job, AnalysisProgress analysisProgress) {}
}
