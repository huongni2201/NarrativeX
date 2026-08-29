package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterContentImportResponse;
import com.narrativex.backend.feature.storyboard.application.command.ImportChapterContentCommand;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportChapterContentUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterRepository chapterRepository;
  private final StoryVersionAccess storyVersionAccess;
  private final StoryboardRevisionAccess storyboardRevisionAccess;
  private final ChapterSourceHasher sourceHasher;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public ApiResponse<ChapterContentImportResponse> execute(ImportChapterContentCommand command) {
    UUID projectId = command.projectId();
    UUID chapterId = command.chapterId();
    String userId = currentUserId.get();
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new IllegalArgumentException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), userId);
    storyboardRevisionAccess.lockChapter(chapterId);
    chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new IllegalArgumentException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), userId);
    validateSourceSize(command.content());
    var normalized = sourceHasher.normalizeAndHash(command.content());
    if (command.title() != null && !command.title().isBlank()) chapter.rename(command.title());
    chapter.updateSource(normalized.text(), normalized.hash());
    var saved = chapterRepository.saveAndFlush(chapter);
    log.info("Imported chapter content for chapterId={} for projectId={}", chapterId, projectId);
    return ApiResponse.success(
        "Chapter content imported",
        new ChapterContentImportResponse(saved.getId(), saved.getRowVersion(), saved.getSourceHash()));
  }

  private void validateSourceSize(String content) {
    if (content == null) throw new IllegalArgumentException("content must not be null");
    if (content.codePointCount(0, content.length()) > limits.getMaxStoryCharacters()) {
      throw new IllegalArgumentException("Chapter exceeds the configured Unicode character limit");
    }
  }
}
