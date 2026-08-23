package com.narrativex.backend.feature.storyboard.api.response;

import java.time.Instant;
import java.util.List;

public record ChapterWorkspaceResponse(
    ChapterResponse chapter,
    String projectName,
    Summary summary,
    Pipeline pipeline,
    List<PreviewScene> previewScenes,
    Capabilities capabilities) {

  public record Summary(int sceneCount, int visualBeatCount, long estimatedDurationSeconds) {}

  public record Pipeline(
      PipelineStep analysis,
      PipelineStep visualPlanning,
      ProgressStep visualGeneration,
      AudioStep audio,
      RenderStep render,
      boolean sourceOutdated) {}

  public record PipelineStep(String status, Instant completedAt) {}

  public record AudioStep(String status, Instant completedAt, String audioUrl, Long durationMs) {}

  public record RenderStep(
      String status, Instant completedAt, String latestJobId, Long artifactId) {}

  public record ProgressStep(String status, int total, int completed, int failed) {}

  public record PreviewScene(
      Long id,
      int orderIndex,
      String title,
      Integer durationSeconds,
      String status,
      int visualBeatCount,
      String previewImageUrl) {}

  public record Capabilities(
      boolean canAnalyze,
      boolean canGenerateVisuals,
      boolean canGenerateAudio,
      boolean canRender,
      String visualGenerationBlockReason) {}
}
