package com.narrativex.backend.feature.generation.application.render;

public final class ProjectRenderProfileFactory {
  private static final String RENDERER_VERSION = "project-image-motion-v3-composition";
  private static final int COMPOSITION_POLICY_VERSION = 1;

  private ProjectRenderProfileFactory() {}

  public static String create(int fps, boolean subtitlesEnabled, boolean watermarkRequired) {
    if (fps != 30 && fps != 60) {
      throw new IllegalArgumentException("fps must be 30 or 60");
    }
    String subtitleMode = subtitlesEnabled ? "burn_in" : "none";
    String watermarkMode = watermarkRequired ? "required" : "none";
    return """
        {"schemaVersion":3,"rendererVersion":"%s","compositionPolicyVersion":%d,"fps":%d,"video":{"x264Preset":"medium","crf":18,"nvencPreset":"p6","nvencCq":19,"pixelFormat":"yuv420p"},"color":{"mode":"SDR_BT709_LIMITED"},"subtitles":{"mode":"%s"},"watermark":{"mode":"%s","policyVersion":1}}
        """
        .formatted(RENDERER_VERSION, COMPOSITION_POLICY_VERSION, fps, subtitleMode, watermarkMode)
        .strip();
  }
}
