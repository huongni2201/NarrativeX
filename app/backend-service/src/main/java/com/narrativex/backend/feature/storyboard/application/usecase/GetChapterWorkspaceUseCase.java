package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterWorkspaceResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterWorkspaceReadRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterWorkspacePipelinePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetChapterWorkspaceUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final ChapterWorkspaceReadRepository chapterWorkspaceReadRepository;

  @Transactional(readOnly = true)
  public ApiResponse<ChapterWorkspaceResponse> execute(Long projectId, Long chapterId) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());

    var snapshot = chapterWorkspaceReadRepository.get(projectId, chapterId);
    var analysis = snapshot.analysis();
    boolean hasStoryboard = snapshot.sceneCount() > 0 && snapshot.visualBeatCount() > 0;
    var pipelineState =
        ChapterWorkspacePipelinePolicy.resolve(
            chapter.getSourceHash(), analysis.status(), analysis.sourceHash(), hasStoryboard);

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

    var response =
        new ChapterWorkspaceResponse(
            ChapterResponse.from(chapter),
            snapshot.projectName(),
            new ChapterWorkspaceResponse.Summary(
                snapshot.sceneCount(),
                snapshot.visualBeatCount(),
                snapshot.estimatedDurationSeconds()),
            new ChapterWorkspaceResponse.Pipeline(
                new ChapterWorkspaceResponse.PipelineStep(
                    pipelineState.analysisStatus(), analysis.completedAt()),
                new ChapterWorkspaceResponse.PipelineStep(
                    pipelineState.planningStatus(), analysis.completedAt()),
                new ChapterWorkspaceResponse.ProgressStep("NOT_STARTED", 0, 0, 0),
                new ChapterWorkspaceResponse.PipelineStep("NOT_STARTED", null),
                new ChapterWorkspaceResponse.PipelineStep("NOT_STARTED", null),
                pipelineState.sourceOutdated()),
            previewScenes,
            new ChapterWorkspaceResponse.Capabilities(
                !chapter.getSourceText().isBlank() && !pipelineState.analysisActive(),
                false,
                false,
                false));

    return ApiResponse.success(response);
  }
}
