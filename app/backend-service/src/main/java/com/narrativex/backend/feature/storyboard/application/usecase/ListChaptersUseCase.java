package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterSummaryResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListChaptersUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;

  @Transactional(readOnly = true)
  public ApiResponse<CursorPage<ChapterSummaryResponse>> execute(
      Long projectId, Long storyVersionId, String cursor, int limit) {
    if (limit < 1 || limit > 100) {
      throw new DomainValidationException("limit must be between 1 and 100");
    }
    storyVersionAccess.requireOwnedStoryVersion(projectId, storyVersionId, currentUserId.get());
    CursorPage<ChapterSummaryResponse> chapters =
        chapterRepository
            .findPageByStoryVersionId(storyVersionId, cursor, limit)
            .map(ChapterSummaryResponse::from);
    return ApiResponse.success(chapters);
  }
}
