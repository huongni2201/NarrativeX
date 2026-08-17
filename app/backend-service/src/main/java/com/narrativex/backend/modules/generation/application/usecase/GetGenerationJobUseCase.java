package com.narrativex.backend.modules.generation.application.usecase;

import com.narrativex.backend.modules.generation.application.command.GetGenerationJobQuery;
import com.narrativex.backend.modules.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
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
    public GenerationJob execute(GetGenerationJobQuery query) {
        return jobRepository.findByJobIdAndOwner(query.jobId(), currentUserId.resolve(query.ownerId()))
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }
}
