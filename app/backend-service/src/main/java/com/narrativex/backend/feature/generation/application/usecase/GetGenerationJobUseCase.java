package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetGenerationJobUseCase {
  private final GenerationJobRepository jobRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public ApiResponse<JobResponse> execute(GetGenerationJobQuery query) {
    GenerationJob job =
        jobRepository
            .findByJobIdAndOwner(query.jobId(), currentUserId.get())
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    return ApiResponse.success("Generation job retrieved successfully", JobResponse.from(job));
  }
}
