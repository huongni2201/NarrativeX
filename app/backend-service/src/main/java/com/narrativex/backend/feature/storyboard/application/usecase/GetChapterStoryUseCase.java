package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterStoryResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterStoryReadRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetChapterStoryUseCase {
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final ChapterStoryReadRepository chapterStoryReadRepository;

  @Transactional(readOnly = true)
  public ApiResponse<ChapterStoryResponse> execute(UUID projectId, UUID chapterId) {
    log.debug("Fetching chapter story for projectId={}, chapterId={}", projectId, chapterId);
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireStoryVersion(projectId, chapter.getStoryVersionId());

    ChapterStoryResponse story = chapterStoryReadRepository.get(projectId, chapterId);
    return ApiResponse.success("Chapter story retrieved successfully", story);
  }
}
