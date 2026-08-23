package com.narrativex.backend.feature.storyboard.application.port.in;

import java.time.Instant;
import java.util.List;

/** Cross-feature read boundary for the chapter readiness projection. */
public interface ChapterWorkspaceAccess {
  Snapshot get(Long projectId, Long chapterId);

  record Snapshot(
      String projectName,
      List<PreviewScene> previewScenes,
      int sceneCount,
      int visualBeatCount,
      long estimatedDurationSeconds,
      String storyboardSourceHash,
      boolean hasApprovedOutput,
      Analysis analysis,
      ChapterWorkspaceProjection projection) {}

  record ChapterWorkspaceProjection(
      ProgressStep visualGeneration, AudioStep audio, RenderStep render) {}

  record ProgressStep(String status, int total, int completed, int failed) {}

  record PipelineStep(String status, Instant completedAt) {}

  record RenderStep(String status, Instant completedAt, String latestJobId, Long artifactId) {}

  record AudioStep(String status, Instant completedAt, String storageKey, Long durationMs) {}

  record PreviewScene(
      long id,
      int orderIndex,
      String title,
      Integer durationSeconds,
      String status,
      int visualBeatCount,
      String previewImageUrl) {}

  record Analysis(String status, String sourceHash, Instant completedAt) {}
}
