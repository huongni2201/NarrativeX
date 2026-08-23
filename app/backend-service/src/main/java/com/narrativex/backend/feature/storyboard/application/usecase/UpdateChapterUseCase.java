package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.application.TextInputEstimator;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.command.UpdateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterContentImportService;
import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class UpdateChapterUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRevisionAccess storyboardRevisionAccess;
  private final ChapterSourceHasher sourceHasher;
  private final ChapterContentImportService contentImportService;
  private final NarrativeXLimitsProperties limits;

  @Autowired
  public UpdateChapterUseCase(
      CurrentUserId currentUserId,
      StoryVersionAccess storyVersionAccess,
      ChapterRepository chapterRepository,
      StoryboardRevisionAccess storyboardRevisionAccess,
      ChapterSourceHasher sourceHasher,
      ChapterContentImportService contentImportService,
      NarrativeXLimitsProperties limits) {
    this.currentUserId = currentUserId;
    this.storyVersionAccess = storyVersionAccess;
    this.chapterRepository = chapterRepository;
    this.storyboardRevisionAccess = storyboardRevisionAccess;
    this.sourceHasher = sourceHasher;
    this.contentImportService = contentImportService;
    this.limits = limits;
  }

  public UpdateChapterUseCase(
      CurrentUserId currentUserId,
      StoryVersionAccess storyVersionAccess,
      ChapterRepository chapterRepository,
      StoryboardRevisionAccess storyboardRevisionAccess,
      ChapterSourceHasher sourceHasher,
      NarrativeXLimitsProperties limits) {
    this(
        currentUserId,
        storyVersionAccess,
        chapterRepository,
        storyboardRevisionAccess,
        sourceHasher,
        null,
        limits);
  }

  @Transactional
  public ApiResponse<ChapterResponse> execute(UpdateChapterCommand command) {
    String userId = currentUserId.get();
    var chapter =
        chapterRepository
            .findById(command.chapterId())
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        command.projectId(), chapter.getStoryVersionId(), userId);

    // Do not acquire the Chapter serialization lock until the caller's project scope is known.
    storyboardRevisionAccess.lockChapter(command.chapterId());
    chapter =
        chapterRepository
            .findById(command.chapterId())
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        command.projectId(), chapter.getStoryVersionId(), userId);
    if (chapter.getRowVersion() != command.expectedRowVersion()) {
      throw new ResourceConflictException("Chapter changed since it was loaded");
    }
    validateSourceSize(command.sourceText());
    var normalized = sourceHasher.normalizeAndHash(command.sourceText());
    chapter.rename(command.title());
    chapter.updateSource(normalized.text(), normalized.hash());
    var saved = chapterRepository.saveAndFlush(chapter);
    if (contentImportService != null) {
      contentImportService.importOriginal(
          saved.getId(), saved.getSourceText(), saved.getSourceHash());
    }
    log.info(
        "Updated chapter id={} (title='{}', rowVersion={}) for projectId={}",
        saved.getId(),
        saved.getTitle(),
        saved.getRowVersion(),
        command.projectId());
    return ApiResponse.success("Chapter updated successfully", ChapterResponse.from(saved));
  }

  private void validateSourceSize(String sourceText) {
    if (sourceText == null) {
      throw new IllegalArgumentException("sourceText must not be null");
    }
    int characterCount = sourceText.codePointCount(0, sourceText.length());
    int estimatedTokens = TextInputEstimator.estimateTokensConservatively(sourceText);
    if (characterCount > limits.getMaxStoryCharacters()) {
      throw new IllegalArgumentException("Chapter exceeds the configured Unicode character limit");
    }
    if (estimatedTokens > limits.getMaxEstimatedInputTokens()) {
      throw new IllegalArgumentException("Chapter exceeds the configured estimated token limit");
    }
  }
}
