package com.narrativex.backend.feature.project.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import org.junit.jupiter.api.Test;

class ProjectStoryVersionLifecycleTest {
  @Test
  void activatingNewVersionSupersedesCurrentActiveVersionAndActivatesProject() {
    Project project = project(42L);
    StoryVersion current = story(10L, 42L, 1, StoryVersionStatus.ACTIVE);
    StoryVersion next = story(11L, 42L, 2, StoryVersionStatus.DRAFT);

    project.activateStoryVersion(next, current);

    assertEquals(StoryVersionStatus.SUPERSEDED, current.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, next.getStatus());
    assertEquals(ProjectStatus.ACTIVE, project.getStatus());
  }

  @Test
  void reconcilingAlreadyActiveVersionRepairsDraftProject() {
    Project project = project(42L);
    StoryVersion active = story(10L, 42L, 1, StoryVersionStatus.ACTIVE);

    project.reconcileActiveStoryVersion(active);

    assertEquals(ProjectStatus.ACTIVE, project.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, active.getStatus());
  }

  @Test
  void activationRejectsStoryVersionFromAnotherProject() {
    Project project = project(42L);
    StoryVersion next = story(11L, 99L, 2, StoryVersionStatus.DRAFT);

    assertThrows(IllegalArgumentException.class, () -> project.activateStoryVersion(next, null));
    assertEquals(StoryVersionStatus.DRAFT, next.getStatus());
    assertEquals(ProjectStatus.DRAFT, project.getStatus());
  }

  private static Project project(Long id) {
    return Project.rehydrate(
        id,
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

  private static StoryVersion story(
      Long id, Long projectId, int versionNumber, StoryVersionStatus status) {
    return StoryVersion.rehydrate(
        id,
        0L,
        projectId,
        versionNumber,
        "story",
        "vi-VN",
        status,
        ModerationDecision.PENDING);
  }
}
