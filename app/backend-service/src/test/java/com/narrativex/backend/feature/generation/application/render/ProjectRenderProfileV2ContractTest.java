package com.narrativex.backend.feature.generation.application.render;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ProjectRenderProfileV2ContractTest {

  @Test
  void createsCanonicalHighQualityProfile() {
    assertEquals(
        "{\"schemaVersion\":2,\"rendererVersion\":\"project-image-motion-v3-composition\",\"compositionPolicyVersion\":1,\"fps\":60,\"video\":{\"x264Preset\":\"medium\",\"crf\":18,\"nvencPreset\":\"p6\",\"nvencCq\":19,\"pixelFormat\":\"yuv420p\"},\"color\":{\"mode\":\"SDR_BT709_LIMITED\"},\"subtitles\":{\"mode\":\"burn_in\"}}",
        ProjectRenderProfileFactory.create(60, true));
  }

  @Test
  void createsSubtitleFreeThirtyFpsProfile() {
    assertEquals(
        "{\"schemaVersion\":2,\"rendererVersion\":\"project-image-motion-v3-composition\",\"compositionPolicyVersion\":1,\"fps\":30,\"video\":{\"x264Preset\":\"medium\",\"crf\":18,\"nvencPreset\":\"p6\",\"nvencCq\":19,\"pixelFormat\":\"yuv420p\"},\"color\":{\"mode\":\"SDR_BT709_LIMITED\"},\"subtitles\":{\"mode\":\"none\"}}",
        ProjectRenderProfileFactory.create(30, false));
  }

  @Test
  void rejectsUnsupportedFrameRate() {
    assertThrows(IllegalArgumentException.class, () -> ProjectRenderProfileFactory.create(24, false));
  }
}
