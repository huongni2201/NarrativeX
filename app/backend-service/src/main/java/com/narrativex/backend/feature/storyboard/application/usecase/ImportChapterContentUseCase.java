package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.application.TextInputEstimator;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterContentImportResponse;
import com.narrativex.backend.feature.storyboard.application.command.ImportChapterContentCommand;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterContentImportService;
import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
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
  private final ChapterContentImportService contentImportService;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public ApiResponse<ChapterContentImportResponse> execute(
      ImportChapterContentCommand command) {
    Long projectId = command.projectId();
    Long chapterId = command.chapterId();
    var chapter = chapterRepository.findById(chapterId).orElseThrow(() -> new IllegalArgumentException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), currentUserId.get());
    storyboardRevisionAccess.lockChapter(chapterId);
    chapter = chapterRepository.findById(chapterId).orElseThrow(() -> new IllegalArgumentException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), currentUserId.get());
    validateSourceSize(command.content());
    var normalized = sourceHasher.normalizeAndHash(command.content());
    if (command.title() != null && !command.title().isBlank()) chapter.rename(command.title());
    chapter.updateSource(normalized.text(), normalized.hash());
    chapterRepository.saveAndFlush(chapter);
    var imported = contentImportService.importOriginal(chapterId, normalized.text(), normalized.hash());
    String status = imported.detection().detectedLanguage();
    log.info(
        "Imported chapter content for chapterId={}, variantId={}, detectedLanguage={} for projectId={}",
        chapterId,
        imported.variant().id(),
        status,
        projectId);
    return ApiResponse.success("Chapter content imported", new ChapterContentImportResponse(
        imported.variant().id(), imported.variant().type().name(), status));
  }

  private void validateSourceSize(String content) {
    if (content.codePointCount(0, content.length()) > limits.getMaxStoryCharacters()
        || TextInputEstimator.estimateTokensConservatively(content) > limits.getMaxEstimatedInputTokens()) {
      throw new IllegalArgumentException("Chapter exceeds the configured content limit");
    }
  }
}
