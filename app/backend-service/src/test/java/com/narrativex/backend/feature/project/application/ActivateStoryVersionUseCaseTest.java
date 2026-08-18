package com.narrativex.backend.feature.project.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.application.usecase.ActivateStoryVersionUseCase;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ActivateStoryVersionUseCaseTest {
  @Mock private ProjectAccess projectAccess;
  @Mock private StoryVersionRepository storyVersionRepository;

  @Test
  void locksProjectAndFlushesSupersededVersionBeforeSavingNewActiveVersion() {
    Project project = project();
    StoryVersion current = story(10L, 1, StoryVersionStatus.ACTIVE);
    StoryVersion next = story(11L, 2, StoryVersionStatus.DRAFT);
    when(projectAccess.findOwnedProjectForUpdate(42L, "owner")).thenReturn(project);
    when(storyVersionRepository.findByIdAndProjectId(11L, 42L)).thenReturn(Optional.of(next));
    when(storyVersionRepository.findActiveByProjectId(42L)).thenReturn(Optional.of(current));
    when(storyVersionRepository.saveAndFlush(any(StoryVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(storyVersionRepository.save(any(StoryVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    CurrentUserId currentUserId = () -> "owner";
    ActivateStoryVersionUseCase useCase =
        new ActivateStoryVersionUseCase(projectAccess, storyVersionRepository, currentUserId);

    var response = useCase.execute(42L, 11L);

    assertEquals(StoryVersionStatus.SUPERSEDED, current.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, next.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, response.data().status());

    InOrder order = inOrder(projectAccess, storyVersionRepository);
    order.verify(projectAccess).findOwnedProjectForUpdate(42L, "owner");
    order.verify(storyVersionRepository).findByIdAndProjectId(11L, 42L);
    order.verify(storyVersionRepository).findActiveByProjectId(42L);
    order.verify(storyVersionRepository).saveAndFlush(current);
    order.verify(storyVersionRepository).save(next);
  }

  private static Project project() {
    return Project.rehydrate(
        42L,
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

  private static StoryVersion story(Long id, int versionNumber, StoryVersionStatus status) {
    return StoryVersion.rehydrate(
        id,
        0L,
        42L,
        versionNumber,
        "story",
        "vi-VN",
        status,
        ModerationDecision.PENDING,
        false,
        "not-required",
        "NOT_REQUIRED",
        null,
        null);
  }
}
