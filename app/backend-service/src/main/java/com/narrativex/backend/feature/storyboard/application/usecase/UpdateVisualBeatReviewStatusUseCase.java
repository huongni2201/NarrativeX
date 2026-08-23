package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UpdateVisualBeatReviewStatusUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRepository storyboardRepository;
  private final StoryboardRevisionAccess storyboardRevisionAccess;

  @Transactional
  public ApiResponse<VisualBeatResponse> execute(
      UUID projectId,
      UUID chapterId,
      UUID sceneId,
      UUID visualBeatId,
      long expectedRowVersion,
      VisualBeatReviewStatus status) {
    storyboardRevisionAccess.lockChapter(chapterId);

    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());

    var scene =
        storyboardRepository
            .findSceneById(sceneId)
            .filter(candidate -> chapterId.equals(candidate.getChapterId()))
            .orElseThrow(() -> new ResourceNotFoundException("Scene not found"));
    var visualBeat =
        storyboardRepository
            .findVisualBeatById(visualBeatId)
            .filter(candidate -> scene.getId().equals(candidate.getSceneId()))
            .orElseThrow(() -> new ResourceNotFoundException("Visual beat not found"));

    if (visualBeat.getRowVersion() != expectedRowVersion) {
      throw new ResourceConflictException(
          "Visual beat was changed by another request; refresh and try again");
    }

    visualBeat.changeReviewStatus(status);
    var saved = storyboardRepository.saveVisualBeat(visualBeat);
    log.info(
        "Updated visual beat id={} review status to '{}' (rowVersion={}) in sceneId={}, chapterId={}, projectId={}",
        visualBeatId,
        status,
        saved.getRowVersion(),
        sceneId,
        chapterId,
        projectId);
    return ApiResponse.success(
        "Visual beat review status updated successfully", VisualBeatResponse.from(saved));
  }
}
