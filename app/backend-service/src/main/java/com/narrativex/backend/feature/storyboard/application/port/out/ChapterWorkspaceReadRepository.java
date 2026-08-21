package com.narrativex.backend.feature.storyboard.application.port.out;

import java.time.Instant;
import java.util.List;

/** Read port for the Chapter Workspace projection. */
public interface ChapterWorkspaceReadRepository {
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

  /** Query-owned pipeline projection assembled from durable generation data. */
  record ChapterWorkspaceProjection(
      ProgressStep visualGeneration, PipelineStep audio, PipelineStep render) {}

  record ProgressStep(String status, int total, int completed, int failed) {}

  record PipelineStep(String status, Instant completedAt) {}

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
