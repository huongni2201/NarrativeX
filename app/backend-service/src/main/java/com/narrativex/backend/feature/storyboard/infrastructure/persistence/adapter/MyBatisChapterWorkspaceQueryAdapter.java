package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterWorkspaceReadRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceAggregateRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspacePreviewRow;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterWorkspaceQueryAdapter implements ChapterWorkspaceReadRepository {
  private final ChapterWorkspaceMapper mapper;

  @Override
  public Snapshot get(UUID projectId, UUID chapterId) {
    ChapterWorkspaceAggregateRow row = mapper.aggregate(projectId, chapterId);
    if (row == null) {
      throw new ResourceNotFoundException("Project not found");
    }
    return new Snapshot(
        row.getProjectName(),
        mapper.previewScenes(projectId, chapterId).stream()
            .map(MyBatisChapterWorkspaceQueryAdapter::toPreview)
            .toList(),
        row.getSceneCount(),
        row.getVisualBeatCount(),
        row.getEstimatedDurationSeconds(),
        row.getStoryboardSourceHash(),
        row.isHasApprovedOutput(),
        new Analysis(
            row.getAnalysisStatus(),
            row.getAnalysisSourceHash(),
            row.getAnalysisCompletedAt(),
            row.getAnalysisLatestJobId(),
            row.getAnalysisVisualGenerationMode(),
            row.getAnalysisImageProvider()),
        new ChapterWorkspaceProjection(
            new ProgressStep(
                progressStatus(
                    row.getVisualGenerationTotal(),
                    row.getVisualGenerationCompleted(),
                    row.getVisualGenerationFailed(),
                    row.getVisualGenerationRunning(),
                    row.getVisualGenerationQueued(),
                    row.getVisualGenerationStalled(),
                    row.getVisualGenerationUnknown(),
                    row.getVisualGenerationPaused()),
                row.getVisualGenerationTotal(),
                row.getVisualGenerationCompleted(),
                row.getVisualGenerationFailed(),
                row.getVisualGenerationLatestJobId(),
                row.getVisualGenerationMediaPlanId(),
                row.getVisualGenerationMediaPlanRevision()),
            new AudioStep(
                narrationStatus(row.isNarrationAssetReady(), row.getNarrationJobStatus()),
                row.getNarrationCompletedAt(),
                row.getNarrationJobId(),
                row.getNarrationVoiceId(),
                row.getNarrationSpeakingRate(),
                row.getNarrationStorageKey(),
                row.getNarrationDurationMs()),
            new RenderStep(
                renderStatus(
                    row.isRenderManifestCreated(),
                    row.getRenderArtifactStatus(),
                    row.getRenderJobStatus()),
                row.getRenderCompletedAt(),
                row.getRenderJobId(),
                row.getRenderArtifactId())));
  }

  private static PreviewScene toPreview(ChapterWorkspacePreviewRow row) {
    return new PreviewScene(
        row.getId(),
        row.getOrderIndex(),
        row.getTitle(),
        row.getDurationSeconds(),
        row.getStatus(),
        row.getVisualBeatCount(),
        row.getPreviewMediaAssetId());
  }

  private static String progressStatus(
      int total,
      int completed,
      int failed,
      int running,
      int queued,
      int stalled,
      int unknown,
      int paused) {
    if (total == 0) return "NOT_STARTED";
    if (running > 0) return "RUNNING";
    if (queued > 0) return "QUEUED";
    if (paused > 0) return "PAUSED_COST_LIMIT";
    if (unknown > 0) return "UNKNOWN";
    if (stalled > 0) return "STALLED";
    if (failed > 0) return "FAILED";
    return completed == total ? "COMPLETED" : "UNKNOWN";
  }

  private static String narrationStatus(boolean assetReady, String jobStatus) {
    if (assetReady) return "READY";
    if (jobStatus == null) return "NOT_STARTED";
    return switch (jobStatus) {
      case "RUNNING" -> "GENERATING";
      case "QUEUED", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> jobStatus;
      default -> "FAILED";
    };
  }

  private static String renderStatus(
      boolean manifestCreated, String artifactStatus, String jobStatus) {
    if ("READY".equals(artifactStatus)) return "READY";
    if ("FAILED".equals(artifactStatus) || "FAILED".equals(jobStatus)) return "FAILED";
    if ("PENDING".equals(artifactStatus) || isActive(jobStatus)) return "PROCESSING";
    return manifestCreated ? "CREATED" : "NOT_STARTED";
  }

  private static boolean isActive(String status) {
    return status != null
        && switch (status) {
          case "QUEUED", "RUNNING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> true;
          default -> false;
        };
  }
}
