package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterWorkspaceResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterWorkspaceAccess.AudioStep;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterWorkspaceReadRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetChapterWorkspaceUseCase {
  @Value("${narrativex.generation.media-enabled:false}")
  private boolean mediaGenerationEnabled;

  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final ChapterAnalysisSnapshotRepository chapterAnalysisSnapshotRepository;
  private final ChapterWorkspaceReadRepository chapterWorkspaceReadRepository;

  @Transactional(readOnly = true)
  public ApiResponse<ChapterWorkspaceResponse> execute(UUID projectId, UUID chapterId) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());

    var snapshot = chapterWorkspaceReadRepository.get(projectId, chapterId);
    var analysis = snapshot.analysis();
    boolean hasStoryboard = snapshot.sceneCount() > 0 && snapshot.visualBeatCount() > 0;
    boolean sourceOutdated =
        snapshot.storyboardSourceHash() != null
            && !snapshot.storyboardSourceHash().equals(chapter.getSourceHash());
    String analysisStatus = analysis.status() == null ? "NOT_STARTED" : analysis.status();
    String planningStatus =
        hasStoryboard && !sourceOutdated && "COMPLETED".equals(analysisStatus)
            ? "COMPLETED"
            : "NOT_STARTED";
    var projection = snapshot.projection();
    var visualGeneration = projection.visualGeneration();
    var audio = projection.audio();
    var render = projection.render();
    String audioUrl = createAudioUrl(audio);

    var previewScenes =
        snapshot.previewScenes().stream()
            .map(
                scene ->
                    new ChapterWorkspaceResponse.PreviewScene(
                        scene.id(),
                        scene.orderIndex(),
                        scene.title(),
                        scene.durationSeconds(),
                        scene.status(),
                        scene.visualBeatCount(),
                        scene.previewImageUrl()))
            .toList();

    boolean canAnalyze =
        !chapter.getSourceText().isBlank()
            && !isActive(analysisStatus)
            && !(snapshot.hasApprovedOutput() && !sourceOutdated);
    boolean chapterAnalysisCompleted = "COMPLETED".equals(analysisStatus) && !sourceOutdated;
    boolean originalVariantReady =
        chapterAnalysisSnapshotRepository.existsReadyOriginalVariant(projectId, chapterId);
    boolean visualPlanningCompleted = "COMPLETED".equals(planningStatus);
    boolean visualJobRunning = isActive(visualGeneration.status());
    boolean canGenerateVisuals =
        mediaGenerationEnabled
            && chapterAnalysisCompleted
            && visualPlanningCompleted
            && snapshot.visualBeatCount() > 0
            && originalVariantReady
            && !visualJobRunning;
    String visualGenerationBlockReason =
        visualGenerationBlockReason(
            mediaGenerationEnabled,
            originalVariantReady,
            chapterAnalysisCompleted,
            visualPlanningCompleted,
            snapshot.visualBeatCount(),
            visualJobRunning);
    boolean canGenerateAudio =
        !chapter.getSourceText().isBlank()
            && !"READY".equals(audio.status())
            && !isActive(audio.status());
    boolean hasCurrentMediaPlan =
        visualGeneration.latestJobId() != null
            && visualGeneration.mediaPlanId() != null
            && visualGeneration.mediaPlanRevision() != null;
    boolean canRender =
        mediaGenerationEnabled
            && !sourceOutdated
            && chapterAnalysisCompleted
            && "COMPLETED".equals(planningStatus)
            && "COMPLETED".equals(visualGeneration.status())
            && hasCurrentMediaPlan
            && "READY".equals(audio.status());

    var response =
        new ChapterWorkspaceResponse(
            ChapterResponse.from(chapter),
            snapshot.projectName(),
            new ChapterWorkspaceResponse.Summary(
                snapshot.sceneCount(),
                snapshot.visualBeatCount(),
                snapshot.estimatedDurationSeconds()),
            new ChapterWorkspaceResponse.Pipeline(
                new ChapterWorkspaceResponse.PipelineStep(analysisStatus, analysis.completedAt()),
                new ChapterWorkspaceResponse.PipelineStep(planningStatus, analysis.completedAt()),
                new ChapterWorkspaceResponse.ProgressStep(
                    visualGeneration.status(),
                    visualGeneration.total(),
                    visualGeneration.completed(),
                    visualGeneration.failed(),
                    visualGeneration.latestJobId(),
                    visualGeneration.mediaPlanId(),
                    visualGeneration.mediaPlanRevision()),
                new ChapterWorkspaceResponse.AudioStep(
                    audio.status(), audio.completedAt(), audioUrl, audio.durationMs()),
                new ChapterWorkspaceResponse.RenderStep(
                    render.status(), render.completedAt(), render.latestJobId(), render.artifactId()),
                sourceOutdated),
            previewScenes,
            new ChapterWorkspaceResponse.Capabilities(
                canAnalyze,
                canGenerateVisuals,
                canGenerateAudio,
                canRender,
                visualGenerationBlockReason));

    return ApiResponse.success(response);
  }

  private static boolean isActive(String status) {
    if (status == null) {
      return false;
    }
    return switch (status) {
      case "QUEUED", "RUNNING", "GENERATING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> true;
      default -> false;
    };
  }

  private static String visualGenerationBlockReason(
      boolean mediaGenerationEnabled,
      boolean originalVariantReady,
      boolean analysisCompleted,
      boolean visualPlanningCompleted,
      int visualBeatCount,
      boolean visualJobRunning) {
    if (!originalVariantReady) return "CONTENT_VARIANT_NOT_READY";
    if (!analysisCompleted) return "ANALYSIS_NOT_COMPLETED";
    if (!visualPlanningCompleted) return "VISUAL_PLANNING_NOT_COMPLETED";
    if (visualBeatCount == 0) return "NO_VISUAL_BEATS";
    if (!mediaGenerationEnabled) return "MEDIA_GENERATION_DISABLED";
    if (visualJobRunning) return "VISUAL_GENERATION_IN_PROGRESS";
    return null;
  }

  private String createAudioUrl(AudioStep audio) {
    if (!"READY".equals(audio.status()) || audio.storageKey() == null) return null;
    try {
      return objectStorage
          .createDownload(audio.storageKey(), Instant.now().plusSeconds(900))
          .downloadUrl()
          .toString();
    } catch (FeatureNotAvailableException | IllegalArgumentException ignored) {
      return null;
    }
  }
}
