package com.narrativex.backend.feature.project.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateStoryVersionUseCaseTest {
  private static final UUID PROJECT_ID = UuidV7.random();

  @Mock private ProjectAccess projectAccess;
  @Mock private StoryVersionRepository storyVersionRepository;

  @Test
  void locksProjectBeforeAllocatingNextVersion() {
    when(projectAccess.findOwnedProjectForUpdate(PROJECT_ID, "owner")).thenReturn(project());
    when(storyVersionRepository.findMaxVersionNumberByProjectId(PROJECT_ID)).thenReturn(3);
    when(storyVersionRepository.save(any(StoryVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    CurrentUserId currentUserId = () -> "owner";
    CreateStoryVersionUseCase useCase =
        new CreateStoryVersionUseCase(
            projectAccess, storyVersionRepository, currentUserId, new NarrativeXLimitsProperties());

    StoryVersion response =
        useCase.execute(new CreateStoryVersionCommand(PROJECT_ID, "story", "vi-VN", "owner"));

    assertEquals(4, response.getVersionNumber());
    verify(projectAccess).findOwnedProjectForUpdate(PROJECT_ID, "owner");
    verify(projectAccess, never()).findOwnedProject(PROJECT_ID, "owner");
  }

  private static Project project() {
    return Project.rehydrate(
        PROJECT_ID,
        0L,
        "Project",
        "owner",
        ProjectStatus.DRAFT,
        "vi-VN",
        "vi-VN",
        "vi-VN",
        AspectRatio.RATIO_16_9,
        ImageQualityTier.STANDARD,
        null);
  }
}
