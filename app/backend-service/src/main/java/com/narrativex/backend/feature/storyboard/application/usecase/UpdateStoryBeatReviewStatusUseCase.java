package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.StoryBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.entity.StoryBeat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UpdateStoryBeatReviewStatusUseCase {
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRepository storyboardRepository;
  private final StoryboardRevisionAccess storyboardRevisionAccess;

  @Transactional
  public ApiResponse<StoryBeatResponse> execute(
      UUID projectId, UUID chapterId, UUID storyBeatId, long expectedRowVersion, String status) {
    storyboardRevisionAccess.lockChapter(chapterId);

    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireStoryVersion(projectId, chapter.getStoryVersionId());

    try {
      StoryBeat updated =
          storyboardRepository.updateStoryBeatReviewStatus(
              chapterId, storyBeatId, status, expectedRowVersion);

      log.info(
          "Updated story beat id={} review status to '{}' (rowVersion={}) in chapterId={}, projectId={}",
          storyBeatId,
          status,
          updated.getRowVersion(),
          chapterId,
          projectId);

      return ApiResponse.success(
          "Story beat review status updated successfully",
          new StoryBeatResponse(
              updated.getId(),
              updated.getSceneId(),
              updated.getOrderIndex(),
              updated.getPurpose(),
              updated.getSummary(),
              updated.getImportance(),
              updated.getReviewStatus(),
              updated.getRowVersion()));
    } catch (OptimisticLockingFailureException ex) {
      throw new ResourceConflictException(
          "Story beat was changed by another request; refresh and try again");
    }
  }
}
