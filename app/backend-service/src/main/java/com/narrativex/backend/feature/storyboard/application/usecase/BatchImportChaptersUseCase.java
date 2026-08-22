package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.application.TextInputEstimator;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterDocumentTextExtractor;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterImportSplitter;
import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
import com.narrativex.backend.feature.storyboard.application.service.ChapterContentImportService;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BatchImportChaptersUseCase {
  private static final int MAX_FILE_BYTES = 10 * 1024 * 1024;
  private static final int MAX_CHAPTERS_PER_IMPORT = 100;

  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final ChapterDocumentTextExtractor documentTextExtractor;
  private final ChapterImportSplitter splitter;
  private final ChapterSourceHasher sourceHasher;
  private final NarrativeXLimitsProperties limits;
  private final ChapterContentImportService contentImportService;

  @Transactional
  public List<ChapterResponse> execute(
      Long projectId, Long storyVersionId, String fileName, String contentType, byte[] content) {
    if (content == null || content.length == 0)
      throw new IllegalArgumentException("Import file must not be empty");
    if (content.length > MAX_FILE_BYTES)
      throw new IllegalArgumentException("Import file exceeds 10 MB limit");

    storyVersionAccess.requireOwnedStoryVersion(projectId, storyVersionId, currentUserId.get());
    String extracted = documentTextExtractor.extract(fileName, contentType, content);
    var drafts = splitter.split(extracted, fileName);
    if (drafts.size() > MAX_CHAPTERS_PER_IMPORT) {
      throw new IllegalArgumentException("Import document contains more than 100 chapters");
    }

    List<Chapter> existing = chapterRepository.findAllByStoryVersionId(storyVersionId);
    int nextOrderIndex =
        existing.stream()
                .max(Comparator.comparingInt(Chapter::getOrderIndex))
                .map(Chapter::getOrderIndex)
                .orElse(-1)
            + 1;

    List<ChapterResponse> imported = new ArrayList<>(drafts.size());
    for (var draft : drafts) {
      validateSourceSize(draft.sourceText());
      if (chapterRepository.existsByStoryVersionIdAndOrderIndex(storyVersionId, nextOrderIndex)) {
        throw new IllegalStateException(
            "Chapter order changed during batch import; retry the request");
      }
      var normalized = sourceHasher.normalizeAndHash(draft.sourceText());
      Chapter saved =
          chapterRepository.saveAndFlush(
          new Chapter(
                  storyVersionId,
                  nextOrderIndex,
                  draft.title(),
                  normalized.text(),
                  normalized.hash()));
      contentImportService.importOriginal(saved.getId(), saved.getSourceText(), saved.getSourceHash());
      imported.add(ChapterResponse.from(saved));
      nextOrderIndex++;
    }
    return List.copyOf(imported);
  }

  private void validateSourceSize(String sourceText) {
    int characterCount = sourceText.codePointCount(0, sourceText.length());
    int estimatedTokens = TextInputEstimator.estimateTokensConservatively(sourceText);
    if (characterCount > limits.getMaxStoryCharacters()) {
      throw new IllegalArgumentException(
          "Imported chapter exceeds the configured Unicode character limit");
    }
    if (estimatedTokens > limits.getMaxEstimatedInputTokens()) {
      throw new IllegalArgumentException(
          "Imported chapter exceeds the configured estimated token limit");
    }
  }
}
