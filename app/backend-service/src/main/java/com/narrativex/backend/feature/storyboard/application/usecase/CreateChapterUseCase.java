package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.application.TextInputEstimator;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateChapterUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final ChapterSourceHasher sourceHasher;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public ApiResponse<ChapterResponse> execute(CreateChapterCommand command) {
    String ownerId = currentUserId.get();
    storyVersionAccess.requireOwnedStoryVersion(
        command.projectId(), command.storyVersionId(), ownerId);
    validateSourceSize(command.sourceText());
    if (chapterRepository.existsByStoryVersionIdAndOrderIndex(
        command.storyVersionId(), command.orderIndex())) {
      throw new ResourceConflictException("Chapter order already exists in this story version");
    }

    var normalized = sourceHasher.normalizeAndHash(command.sourceText());
    Chapter chapter =
        new Chapter(
            command.storyVersionId(),
            command.orderIndex(),
            command.title(),
            normalized.text(),
            normalized.hash());
    Chapter saved = chapterRepository.saveAndFlush(chapter);
    log.info(
        "Created chapter id={} (orderIndex={}, title='{}') in storyVersionId={} for projectId={}",
        saved.getId(),
        saved.getOrderIndex(),
        saved.getTitle(),
        command.storyVersionId(),
        command.projectId());
    return ApiResponse.success("Chapter created successfully", ChapterResponse.from(saved));
  }

  private void validateSourceSize(String sourceText) {
    if (sourceText == null) throw new IllegalArgumentException("sourceText must not be null");
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
