package com.narrativex.backend.modules.generation.application.usecase;

import com.narrativex.backend.modules.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.modules.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.modules.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.modules.generation.domain.model.JobType;
import com.narrativex.backend.modules.generation.domain.model.OperationPlan;
import com.narrativex.backend.modules.generation.domain.model.ResourceClass;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.shared.security.CurrentUserId;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EnqueueStoryAnalysisUseCase {

    private final GenerationJobRepository jobRepository;
    private final OperationPlanRepository operationPlanRepository;
    private final ProjectAccess projectAccess;
    private final CurrentUserId currentUserId;

    public EnqueueStoryAnalysisUseCase(GenerationJobRepository jobRepository,
                                       OperationPlanRepository operationPlanRepository,
                                       ProjectAccess projectAccess, CurrentUserId currentUserId) {
        this.jobRepository = jobRepository;
        this.operationPlanRepository = operationPlanRepository;
        this.projectAccess = projectAccess;
        this.currentUserId = currentUserId;
    }

    /** Queue-only contract: a worker/provider must claim the durable job before any external call. */
    @Transactional
    public GenerationJob execute(EnqueueStoryAnalysisCommand command) {
        String ownerId = currentUserId.resolve(command.ownerId());
        var project = projectAccess.findOwnedProject(command.projectId(), ownerId);
        operationPlanRepository.save(OperationPlan.create(project.getId(), "STORY_ANALYZE",
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
        return jobRepository.save(GenerationJob.create(project.getId(), JobType.STORY_ANALYZE,
            ResourceClass.PROVIDER_INTERACTIVE, ownerId));
    }
}
