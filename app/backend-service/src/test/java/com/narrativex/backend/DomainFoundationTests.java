package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DomainFoundationTests {

  @Test
  void aspectRatioUsesStableUserFacingCode() {
    assertEquals(AspectRatio.RATIO_9_16, AspectRatio.fromCode("9:16"));
    assertThrows(IllegalArgumentException.class, () -> AspectRatio.fromCode("2:1"));
  }

  @Test
  void storyVersionCanActivateWithoutRightsAttestation() {
    StoryVersion story = StoryVersion.create(UUID.randomUUID(), 1, "text", "en-US");

    story.activate();

    assertEquals(StoryVersionStatus.ACTIVE, story.getStatus());
  }
}
