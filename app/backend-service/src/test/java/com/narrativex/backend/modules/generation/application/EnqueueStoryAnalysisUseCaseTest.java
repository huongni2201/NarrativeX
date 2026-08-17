package com.narrativex.backend.modules.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.modules.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.modules.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.modules.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.modules.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.modules.generation.domain.aggregate.JobType;
import com.narrativex.backend.modules.generation.domain.aggregate.ResourceClass;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.domain.aggregate.AspectRatio;
import com.narrativex.backend.modules.project.domain.aggregate.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.aggregate.Project;
import com.narrativex.backend.modules.project.domain.aggregate.ProjectStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EnqueueStoryAnalysisUseCaseTest {
    @Mock private GenerationJobRepository jobRepository;
    @Mock private OperationPlanRepository operationPlanRepository;
    @Mock private ProjectAccess projectAccess;

    @Test
    void generationUsesProjectApplicationAccessBoundary() {
        Project project = Project.rehydrate(7L, 0L, "Project", "owner", ProjectStatus.DRAFT,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);
        GenerationJob savedJob = GenerationJob.create(7L, JobType.STORY_ANALYZE,
            ResourceClass.PROVIDER_INTERACTIVE, "owner");
        when(projectAccess.findOwnedProject(7L, "owner")).thenReturn(project);
        when(jobRepository.save(any(GenerationJob.class))).thenReturn(savedJob);
        CurrentUserId currentUserId = requested -> requested == null ? "local-dev-user" : requested;
        EnqueueStoryAnalysisUseCase useCase = new EnqueueStoryAnalysisUseCase(jobRepository,
            operationPlanRepository, projectAccess, currentUserId);

        var response = useCase.execute(new EnqueueStoryAnalysisCommand(7L, "owner"));

        assertEquals(savedJob.getJobId(), response.data().jobId());
        verify(projectAccess).findOwnedProject(7L, "owner");
    }
}
