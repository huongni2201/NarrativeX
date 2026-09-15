package com.narrativex.backend.feature.generation.application.usecase;

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

  @Transactional(readOnly = true)
  public GenerationJob execute(GetGenerationJobQuery query) {
    return jobRepository
        .findByJobId(query.jobId())
        .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
  }

  @Transactional(readOnly = true)
  public JobDetails executeWithProgress(GetGenerationJobQuery query) {
    GenerationJob job =
        jobRepository
            .findByJobId(query.jobId())
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    AnalysisProgress analysisProgress =
        jobRepository.findAnalysisProgressByJobId(query.jobId()).orElse(null);
    return new JobDetails(job, analysisProgress);
  }

  public record JobDetails(GenerationJob job, AnalysisProgress analysisProgress) {}
}
