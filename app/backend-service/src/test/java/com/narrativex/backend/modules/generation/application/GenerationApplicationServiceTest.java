package com.narrativex.backend.modules.generation.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.generation.domain.GenerationJob;
import com.narrativex.backend.modules.generation.repository.GenerationJobRepository;
import com.narrativex.backend.modules.generation.repository.OperationPlanRepository;
import com.narrativex.backend.modules.project.application.ProjectAccess;
import com.narrativex.backend.modules.project.domain.Project;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GenerationApplicationServiceTest {

    @Mock
    private GenerationJobRepository jobRepository;
    @Mock
    private OperationPlanRepository operationPlanRepository;
    @Mock
    private ProjectAccess projectAccess;

    @Test
    void generationUsesProjectApplicationAccessBoundary() {
        Project project = new Project("Project", "owner");
        GenerationJob savedJob = new GenerationJob(project,
            com.narrativex.backend.modules.generation.domain.JobType.STORY_ANALYZE,
            com.narrativex.backend.modules.generation.domain.ResourceClass.PROVIDER_INTERACTIVE, "owner");
        when(projectAccess.findOwnedProject(7L, "owner")).thenReturn(project);
        when(jobRepository.save(any(GenerationJob.class))).thenReturn(savedJob);

        GenerationApplicationService service = new GenerationApplicationService(jobRepository, operationPlanRepository,
            projectAccess, new CurrentUserId(false, "local-dev-user"));

        assertSame(savedJob, service.enqueueStoryAnalysis(7L, "owner"));
        verify(projectAccess).findOwnedProject(7L, "owner");
    }
}
