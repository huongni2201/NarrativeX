package com.narrativex.backend.feature.project.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.project.domain.exception.ArchivedProjectException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProjectAggregateTest {
  @Test
  void projectAggregateCreatesStoryVersionWithItsOwnIdentityBoundary() {
    UUID projectId = UuidV7.random();
    Project project =
        Project.rehydrate(
            projectId,
            0L,
            "Story",
            "owner",
            ProjectStatus.DRAFT,
            "vi-VN",
            "vi-VN",
            "vi-VN",
            AspectRatio.RATIO_16_9,
            null);

    StoryVersion storyVersion = project.createStoryVersion(1, "content", "vi-VN");

    assertEquals(projectId, storyVersion.getProjectId());
    assertEquals(1, storyVersion.getVersionNumber());
  }

  @Test
  void archivedProjectCannotCreateStoryVersion() {
    UUID projectId = UuidV7.random();
    Project project =
        Project.rehydrate(
            projectId,
            0L,
            "Story",
            "owner",
            ProjectStatus.ARCHIVED,
            "vi-VN",
            "vi-VN",
            "vi-VN",
            AspectRatio.RATIO_16_9,
            null);

    assertThrows(
        ArchivedProjectException.class, () -> project.createStoryVersion(1, "content", "vi-VN"));
  }
}
