package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterSummaryResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import java.util.List;
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
  public ApiResponse<List<ChapterSummaryResponse>> execute(Long projectId, Long storyVersionId) {
    storyVersionAccess.requireOwnedStoryVersion(projectId, storyVersionId, currentUserId.get());
    List<ChapterSummaryResponse> chapters =
        chapterRepository.findAllByStoryVersionId(storyVersionId).stream()
            .map(ChapterSummaryResponse::from)
            .toList();
    return ApiResponse.success(chapters);
  }
}
