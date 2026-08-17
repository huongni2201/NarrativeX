package com.narrativex.backend.feature.project.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.aggregate.StoryVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateStoryVersionUseCaseTest {
    @Mock private ProjectAccess projectAccess;
    @Mock private StoryVersionRepository storyVersionRepository;

    @Test
    void locksProjectBeforeAllocatingNextVersion() {
        when(projectAccess.findOwnedProjectForUpdate(42L, "owner")).thenReturn(project());
        when(storyVersionRepository.findMaxVersionNumberByProjectId(42L)).thenReturn(3);
        when(storyVersionRepository.save(any(StoryVersion.class))).thenAnswer(invocation -> invocation.getArgument(0));
        CurrentUserId currentUserId = requested -> requested == null ? "local-dev-user" : requested;
        CreateStoryVersionUseCase useCase = new CreateStoryVersionUseCase(projectAccess,
            storyVersionRepository, currentUserId, new NarrativeXLimitsProperties());

        var response = useCase.execute(new CreateStoryVersionCommand(42L, "story", "vi-VN",
            true, "rights-v1.7", "USER_ATTESTED_RIGHTS_OR_LICENSE", "owner"));

        assertEquals(4, response.data().versionNumber());
        verify(projectAccess).findOwnedProjectForUpdate(42L, "owner");
        verify(projectAccess, never()).findOwnedProject(42L, "owner");
    }

    private static Project project() {
        return Project.rehydrate(42L, 0L, "Project", "owner", ProjectStatus.DRAFT,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);
    }
}
