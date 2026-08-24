package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterContentVariantResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterContentVariantRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListChapterContentVariantsUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterRepository chapterRepository;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterContentVariantRepository variantRepository;

  @Transactional(readOnly = true)
  public ApiResponse<List<ChapterContentVariantResponse>> execute(UUID projectId, UUID chapterId) {
    String userId = currentUserId.get();
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new IllegalArgumentException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), userId);
    return ApiResponse.success(
        variantRepository.findAllOwned(projectId, chapterId, userId).stream()
            .map(ChapterContentVariantResponse::from)
            .toList());
  }
}
