package com.narrativex.backend.feature.generation.application.render;

public final class ProjectRenderProfileFactory {
  private static final String RENDERER_VERSION = "project-image-motion-v3-composition";
  private static final int COMPOSITION_POLICY_VERSION = 1;

  private ProjectRenderProfileFactory() {}

  public static String create(int fps, boolean subtitlesEnabled, boolean watermarkRequired) {
    if (fps != 24 && fps != 30 && fps != 60) {
      throw new IllegalArgumentException("fps must be 24, 30, or 60");
    }
    String subtitleMode = subtitlesEnabled ? "burn_in" : "none";
    String watermarkMode = watermarkRequired ? "required" : "none";
    return """
        {"schemaVersion":3,"rendererVersion":"%s","compositionPolicyVersion":%d,"fps":%d,"video":{"x264Preset":"medium","crf":18,"nvencPreset":"p6","nvencCq":19,"pixelFormat":"yuv420p"},"color":{"mode":"SDR_BT709_LIMITED"},"subtitles":{"mode":"%s"},"watermark":{"mode":"%s","policyVersion":1}}
        """
        .formatted(RENDERER_VERSION, COMPOSITION_POLICY_VERSION, fps, subtitleMode, watermarkMode)
        .strip();
  }

  public static String create(
      int fps, boolean subtitlesEnabled, boolean watermarkRequired, String audioMode) {
    if (!"NATIVE_TAKE".equals(audioMode) && !"EXTERNAL_NARRATION".equals(audioMode)) {
      throw new IllegalArgumentException("Invalid render audio mode");
    }
    return create(fps, subtitlesEnabled, watermarkRequired)
        .replace("\"schemaVersion\":3", "\"schemaVersion\":4,\"audioMode\":\"" + audioMode + "\"")
        .replace(RENDERER_VERSION, "project-native-av-v4");
  }

  public static String create(
      int fps,
      boolean subtitlesEnabled,
      boolean watermarkRequired,
      String audioMode,
      SubtitleStyle subtitleStyle) {
    if (!"NATIVE_TAKE".equals(audioMode) && !"EXTERNAL_NARRATION".equals(audioMode)) {
      throw new IllegalArgumentException("Invalid render audio mode");
    }
    String profile =
        "NATIVE_TAKE".equals(audioMode)
            ? create(fps, subtitlesEnabled, watermarkRequired, audioMode)
            : create(fps, subtitlesEnabled, watermarkRequired);
    return profile.replace(
        "\"subtitles\":{\"mode\":\"" + (subtitlesEnabled ? "burn_in" : "none") + "\"}",
        "\"subtitles\":{\"mode\":\""
            + (subtitlesEnabled ? "burn_in" : "none")
            + "\",\"style\":"
            + subtitleStyle.toJson()
            + "}");
  }
}
