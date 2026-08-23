package com.narrativex.backend.feature.project.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProjectStoryVersionLifecycleTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID OTHER_PROJECT_ID = UuidV7.random();
  private static final UUID STORY_10 = UuidV7.random();
  private static final UUID STORY_11 = UuidV7.random();

  @Test
  void activatingNewVersionSupersedesCurrentActiveVersionAndActivatesProject() {
    Project project = project(PROJECT_ID);
    StoryVersion current = story(STORY_10, PROJECT_ID, 1, StoryVersionStatus.ACTIVE);
    StoryVersion next = story(STORY_11, PROJECT_ID, 2, StoryVersionStatus.DRAFT);

    project.activateStoryVersion(next, current);

    assertEquals(StoryVersionStatus.SUPERSEDED, current.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, next.getStatus());
    assertEquals(ProjectStatus.ACTIVE, project.getStatus());
  }

  @Test
  void reconcilingAlreadyActiveVersionRepairsDraftProject() {
    Project project = project(PROJECT_ID);
    StoryVersion active = story(STORY_10, PROJECT_ID, 1, StoryVersionStatus.ACTIVE);

    project.reconcileActiveStoryVersion(active);

    assertEquals(ProjectStatus.ACTIVE, project.getStatus());
    assertEquals(StoryVersionStatus.ACTIVE, active.getStatus());
  }

  @Test
  void activationRejectsStoryVersionFromAnotherProject() {
    Project project = project(PROJECT_ID);
    StoryVersion next = story(STORY_11, OTHER_PROJECT_ID, 2, StoryVersionStatus.DRAFT);

    assertThrows(IllegalArgumentException.class, () -> project.activateStoryVersion(next, null));
    assertEquals(StoryVersionStatus.DRAFT, next.getStatus());
    assertEquals(ProjectStatus.DRAFT, project.getStatus());
  }

  private static Project project(UUID id) {
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
      UUID id, UUID projectId, int versionNumber, StoryVersionStatus status) {
    return StoryVersion.rehydrate(
        id, 0L, projectId, versionNumber, "story", "vi-VN", status, ModerationDecision.PENDING);
  }
}
