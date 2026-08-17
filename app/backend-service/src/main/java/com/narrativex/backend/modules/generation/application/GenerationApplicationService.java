package com.narrativex.backend.modules.generation.application;

import com.narrativex.backend.modules.generation.domain.GenerationJob;
import com.narrativex.backend.modules.generation.domain.JobType;
import com.narrativex.backend.modules.generation.domain.OperationPlan;
import com.narrativex.backend.modules.generation.domain.ResourceClass;
import com.narrativex.backend.modules.generation.repository.GenerationJobRepository;
import com.narrativex.backend.modules.generation.repository.OperationPlanRepository;
import com.narrativex.backend.modules.project.application.ProjectAccess;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GenerationApplicationService {

    private final GenerationJobRepository jobRepository;
    private final OperationPlanRepository operationPlanRepository;
    private final ProjectAccess projectAccess;
    private final CurrentUserId currentUserId;

    public GenerationApplicationService(GenerationJobRepository jobRepository,
                                        OperationPlanRepository operationPlanRepository,
                                        ProjectAccess projectAccess,
                                        CurrentUserId currentUserId) {
        this.jobRepository = jobRepository;
        this.operationPlanRepository = operationPlanRepository;
        this.projectAccess = projectAccess;
        this.currentUserId = currentUserId;
    }

    /** Queue-only contract: a worker/provider must claim the durable job before any external call. */
    @Transactional
    public GenerationJob enqueueStoryAnalysis(Long projectId, String ownerId) {
        String resolvedOwner = currentUserId.resolve(ownerId);
        var project = projectAccess.findOwnedProject(projectId, resolvedOwner);
        operationPlanRepository.save(new OperationPlan(project, "STORY_ANALYZE",
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
        return jobRepository.save(new GenerationJob(project, JobType.STORY_ANALYZE,
            ResourceClass.PROVIDER_INTERACTIVE, resolvedOwner));
    }

    @Transactional(readOnly = true)
    public GenerationJob getJob(String jobId, String ownerId) {
        return jobRepository.findByJobIdAndProjectOwnerId(jobId, currentUserId.resolve(ownerId))
            .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }
}
