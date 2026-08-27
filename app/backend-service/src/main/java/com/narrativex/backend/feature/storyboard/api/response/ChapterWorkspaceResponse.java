package com.narrativex.backend.feature.storyboard.api.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

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

  public record AudioStep(
      String status, Instant completedAt, UUID latestJobId, String audioUrl, Long durationMs) {}

  public record RenderStep(String status, Instant completedAt, UUID latestJobId, Long artifactId) {}

  public record ProgressStep(
      String status,
      int total,
      int completed,
      int failed,
      UUID latestJobId,
      UUID mediaPlanId,
      Integer mediaPlanRevision) {}

  public record PreviewScene(
      UUID id,
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
