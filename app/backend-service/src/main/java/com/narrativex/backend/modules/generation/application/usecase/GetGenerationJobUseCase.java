package com.narrativex.backend.modules.generation.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.common.exception.ResourceNotFoundException;
import com.narrativex.backend.modules.common.response.ApiResponse;
import com.narrativex.backend.modules.generation.api.response.JobResponse;
import com.narrativex.backend.modules.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.modules.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.modules.generation.domain.aggregate.GenerationJob;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GetGenerationJobUseCase {
    private final GenerationJobRepository jobRepository;
    private final CurrentUserId currentUserId;

    public GetGenerationJobUseCase(GenerationJobRepository jobRepository, CurrentUserId currentUserId) {
        this.jobRepository = jobRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional(readOnly = true)
    public ApiResponse<JobResponse> execute(GetGenerationJobQuery query) {
        GenerationJob job = jobRepository.findByJobIdAndOwner(query.jobId(), currentUserId.resolve(query.ownerId()))
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
        return ApiResponse.success("Generation job retrieved successfully", JobResponse.from(job));
    }
}
