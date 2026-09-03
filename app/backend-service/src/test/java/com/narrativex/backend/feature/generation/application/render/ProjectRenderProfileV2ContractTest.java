package com.narrativex.backend.feature.generation.application.render;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ProjectRenderProfileV2ContractTest {
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void createsCanonicalHighQualityProfile() throws Exception {
    JsonNode profile = objectMapper.readTree(ProjectRenderProfileFactory.create(60, true));

    assertEquals(2, profile.path("schemaVersion").asInt());
    assertEquals("project-image-motion-v3-composition", profile.path("rendererVersion").asText());
    assertEquals(1, profile.path("compositionPolicyVersion").asInt());
    assertEquals(60, profile.path("fps").asInt());
    assertEquals("medium", profile.path("video").path("x264Preset").asText());
    assertEquals(18, profile.path("video").path("crf").asInt());
    assertEquals("p6", profile.path("video").path("nvencPreset").asText());
    assertEquals(19, profile.path("video").path("nvencCq").asInt());
    assertEquals("yuv420p", profile.path("video").path("pixelFormat").asText());
    assertEquals("SDR_BT709_LIMITED", profile.path("color").path("mode").asText());
    assertEquals("burn_in", profile.path("subtitles").path("mode").asText());
  }

  @Test
  void createsSubtitleFreeThirtyFpsProfile() throws Exception {
    JsonNode profile = objectMapper.readTree(ProjectRenderProfileFactory.create(30, false));

    assertEquals(30, profile.path("fps").asInt());
    assertEquals("none", profile.path("subtitles").path("mode").asText());
  }

  @Test
  void rejectsUnsupportedFrameRate() {
    assertThrows(IllegalArgumentException.class, () -> ProjectRenderProfileFactory.create(24, false));
  }
}
