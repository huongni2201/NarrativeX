package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterWorkspaceReadRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceAggregateRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspacePreviewRow;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterWorkspaceQueryAdapter implements ChapterWorkspaceReadRepository {
  private final ChapterWorkspaceMapper mapper;

  @Override
  public Snapshot get(Long projectId, Long chapterId) {
    ChapterWorkspaceAggregateRow row = mapper.aggregate(projectId, chapterId);
    if (row == null) {
      throw new ResourceNotFoundException("Project not found");
    }
    return new Snapshot(
        row.getProjectName(),
        mapper.previewScenes(projectId, chapterId).stream().map(MyBatisChapterWorkspaceQueryAdapter::toPreview).toList(),
        row.getSceneCount(), row.getVisualBeatCount(), row.getEstimatedDurationSeconds(),
        row.getStoryboardSourceHash(), row.isHasApprovedOutput(),
        new Analysis(row.getAnalysisStatus(), row.getAnalysisSourceHash(), row.getAnalysisCompletedAt()),
        new ChapterWorkspaceProjection(
            new ProgressStep(
                progressStatus(row.getVisualGenerationTotal(), row.getVisualGenerationCompleted(),
                    row.getVisualGenerationFailed(), row.getVisualGenerationRunning(),
                    row.getVisualGenerationQueued(), row.getVisualGenerationActive(),
                    row.getLatestVisualGenerationStatus()),
                row.getVisualGenerationTotal(), row.getVisualGenerationCompleted(), row.getVisualGenerationFailed()),
            new PipelineStep(narrationStatus(row.isNarrationAssetReady(), row.getNarrationJobStatus()), row.getNarrationCompletedAt()),
            new PipelineStep(renderStatus(row.isRenderManifestCreated(), row.getRenderArtifactStatus(), row.getRenderJobStatus()), row.getRenderCompletedAt())));
  }

  private static PreviewScene toPreview(ChapterWorkspacePreviewRow row) {
    return new PreviewScene(row.getId(), row.getOrderIndex(), row.getTitle(), row.getDurationSeconds(),
        row.getStatus(), row.getVisualBeatCount(), row.getPreviewImageUrl());
  }

  private static String progressStatus(int total, int completed, int failed, int running, int queued, int active, String latestStatus) {
    if (total == 0) return "NOT_STARTED";
    if (active > 0) return running > 0 ? "RUNNING" : queued > 0 ? "QUEUED" : latestStatus;
    if (failed > 0) return "FAILED";
    return completed == total ? "COMPLETED" : "QUEUED";
  }

  private static String narrationStatus(boolean assetReady, String jobStatus) {
    if (assetReady) return "READY";
    if ("RUNNING".equals(jobStatus)) return "GENERATING";
    if ("QUEUED".equals(jobStatus)) return "QUEUED";
    return jobStatus == null ? "NOT_STARTED" : "FAILED";
  }

  private static String renderStatus(boolean manifestCreated, String artifactStatus, String jobStatus) {
    if ("READY".equals(artifactStatus)) return "COMPLETED";
    if ("FAILED".equals(artifactStatus) || "FAILED".equals(jobStatus)) return "FAILED";
    if ("PENDING".equals(artifactStatus) || isActive(jobStatus)) return "PROCESSING";
    return manifestCreated ? "CREATED" : "NOT_STARTED";
  }

  private static boolean isActive(String status) {
    return status != null && switch (status) {
      case "QUEUED", "RUNNING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> true;
      default -> false;
    };
  }
}
