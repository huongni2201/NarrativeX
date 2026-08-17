package com.narrativex.backend.modules.project.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.modules.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.modules.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.modules.project.domain.model.AspectRatio;
import com.narrativex.backend.modules.project.domain.model.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.domain.model.ProjectStatus;
import com.narrativex.backend.modules.project.domain.model.StoryVersion;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateStoryVersionUseCaseTest {
    @Mock
    private ProjectAccess projectAccess;
    @Mock
    private StoryVersionRepository storyVersionRepository;

    @Test
    void locksProjectBeforeAllocatingNextVersion() {
        when(projectAccess.findOwnedProjectForUpdate(42L, "owner")).thenReturn(project());
        when(storyVersionRepository.findMaxVersionNumberByProjectId(42L)).thenReturn(3);
        when(storyVersionRepository.save(any(StoryVersion.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        CreateStoryVersionUseCase useCase = new CreateStoryVersionUseCase(projectAccess,
            storyVersionRepository, new CurrentUserId(false, "local-dev-user"),
            new NarrativeXLimitsProperties());

        StoryVersion created = useCase.execute(42L, new CreateStoryVersionCommand("story", "vi-VN",
            true, "rights-v1.7", "USER_ATTESTED_RIGHTS_OR_LICENSE"), "owner");

        assertEquals(4, created.getVersionNumber());
        verify(projectAccess).findOwnedProjectForUpdate(42L, "owner");
        verify(projectAccess, never()).findOwnedProject(42L, "owner");
    }

    private static Project project() {
        return Project.rehydrate(42L, 0L, "Project", "owner", ProjectStatus.DRAFT,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);
    }
}
