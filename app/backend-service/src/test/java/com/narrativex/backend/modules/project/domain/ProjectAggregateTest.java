package com.narrativex.backend.modules.project.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.modules.project.domain.model.AspectRatio;
import com.narrativex.backend.modules.project.domain.model.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.domain.model.ProjectStatus;
import com.narrativex.backend.modules.project.domain.model.StoryVersion;
import org.junit.jupiter.api.Test;

class ProjectAggregateTest {

    @Test
    void projectAggregateCreatesStoryVersionWithItsOwnIdentityBoundary() {
        Project project = Project.rehydrate(42L, 0L, "Story", "owner", ProjectStatus.DRAFT,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);

        StoryVersion storyVersion = project.createStoryVersion(1, "content", "vi-VN", true,
            "rights-v1.7", "USER_ATTESTED_RIGHTS_OR_LICENSE", "owner");

        assertEquals(42L, storyVersion.getProjectId());
        assertEquals(1, storyVersion.getVersionNumber());
    }

    @Test
    void archivedProjectCannotCreateStoryVersion() {
        Project project = Project.rehydrate(42L, 0L, "Story", "owner", ProjectStatus.ARCHIVED,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);

        assertThrows(IllegalStateException.class, () -> project.createStoryVersion(1, "content", "vi-VN",
            true, "rights-v1.7", "USER_ATTESTED_RIGHTS_OR_LICENSE", "owner"));
    }
}
