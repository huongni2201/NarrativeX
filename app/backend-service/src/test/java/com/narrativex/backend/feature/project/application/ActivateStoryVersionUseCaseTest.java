package com.narrativex.backend.feature.project.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.application.usecase.ActivateStoryVersionUseCase;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ActivateStoryVersionUseCaseTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID STORY_10 = UuidV7.random();
  private static final UUID STORY_11 = UuidV7.random();

  @Mock private ProjectAccess projectAccess;
  @Mock private ProjectRepository projectRepository;
  @Mock private StoryVersionRepository storyVersionRepository;

  @Test
  void locksProjectFlushesOldVersionAndPersistsActiveProject() {
    Project project = project();
    StoryVersion current = story(STORY_10, 1, StoryVersionStatus.ACTIVE);
    StoryVersion next = story(STORY_11, 2, StoryVersionStatus.DRAFT);
    when(projectAccess.findOwnedProjectForUpdate(PROJECT_ID, "owner")).thenReturn(project);
    when(storyVersionRepository.findByIdAndProjectId(STORY_11, PROJECT_ID))
        .thenReturn(Optional.of(next));
    when(storyVersionRepository.findActiveByProjectId(PROJECT_ID)).thenReturn(Optional.of(current));
    when(storyVersionRepository.saveAndFlush(any(StoryVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(storyVersionRepository.save(any(StoryVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    CurrentUserId currentUserId = () -> "owner";
    ActivateStoryVersionUseCase useCase =
        new ActivateStoryVersionUseCase(
            projectAccess, projectRepository, storyVersionRepository, currentUserId);

    StoryVersion response = useCase.execute(PROJECT_ID, STORY_11);

    assertEquals(StoryVersionStatus.SUPERSEDED, current.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, next.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, response.getStatus());
    assertEquals(ProjectStatus.ACTIVE, project.getStatus());

    InOrder order = inOrder(projectAccess, storyVersionRepository, projectRepository);
    order.verify(projectAccess).findOwnedProjectForUpdate(PROJECT_ID, "owner");
    order.verify(storyVersionRepository).findByIdAndProjectId(STORY_11, PROJECT_ID);
    order.verify(storyVersionRepository).findActiveByProjectId(PROJECT_ID);
    order.verify(storyVersionRepository).saveAndFlush(current);
    order.verify(storyVersionRepository).save(next);
    order.verify(projectRepository).save(project);
  }

  @Test
  void activatingAlreadyActiveVersionRepairsDraftProject() {
    Project project = project();
    StoryVersion active = story(STORY_10, 1, StoryVersionStatus.ACTIVE);
    when(projectAccess.findOwnedProjectForUpdate(PROJECT_ID, "owner")).thenReturn(project);
    when(storyVersionRepository.findByIdAndProjectId(STORY_10, PROJECT_ID))
        .thenReturn(Optional.of(active));
    when(storyVersionRepository.findActiveByProjectId(PROJECT_ID)).thenReturn(Optional.of(active));
    CurrentUserId currentUserId = () -> "owner";
    ActivateStoryVersionUseCase useCase =
        new ActivateStoryVersionUseCase(
            projectAccess, projectRepository, storyVersionRepository, currentUserId);

    StoryVersion response = useCase.execute(PROJECT_ID, STORY_10);

    assertEquals(StoryVersionStatus.ACTIVE, response.getStatus());
    assertEquals(ProjectStatus.ACTIVE, project.getStatus());
    verify(projectRepository).save(project);
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

  private static StoryVersion story(UUID id, int versionNumber, StoryVersionStatus status) {
    return StoryVersion.rehydrate(id, 0L, PROJECT_ID, versionNumber, "story", "vi-VN", status);
  }
}
