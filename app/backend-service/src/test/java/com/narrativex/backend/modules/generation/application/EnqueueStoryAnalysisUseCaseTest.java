package com.narrativex.backend.modules.generation.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.modules.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.modules.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.modules.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.modules.generation.domain.model.JobType;
import com.narrativex.backend.modules.generation.domain.model.ResourceClass;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.domain.model.AspectRatio;
import com.narrativex.backend.modules.project.domain.model.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.domain.model.ProjectStatus;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EnqueueStoryAnalysisUseCaseTest {

    @Mock
    private GenerationJobRepository jobRepository;
    @Mock
    private OperationPlanRepository operationPlanRepository;
    @Mock
    private ProjectAccess projectAccess;

    @Test
    void generationUsesProjectApplicationAccessBoundary() {
        Project project = Project.rehydrate(7L, 0L, "Project", "owner", ProjectStatus.DRAFT,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);
        GenerationJob savedJob = GenerationJob.create(7L, JobType.STORY_ANALYZE,
            ResourceClass.PROVIDER_INTERACTIVE, "owner");
        when(projectAccess.findOwnedProject(7L, "owner")).thenReturn(project);
        when(jobRepository.save(any(GenerationJob.class))).thenReturn(savedJob);

        EnqueueStoryAnalysisUseCase useCase = new EnqueueStoryAnalysisUseCase(jobRepository,
            operationPlanRepository, projectAccess, new CurrentUserId(false, "local-dev-user"));

        assertSame(savedJob, useCase.execute(new EnqueueStoryAnalysisCommand(7L, "owner")));
        verify(projectAccess).findOwnedProject(7L, "owner");
    }
}
