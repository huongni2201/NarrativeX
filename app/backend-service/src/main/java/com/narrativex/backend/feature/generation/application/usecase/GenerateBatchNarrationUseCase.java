package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.generation.application.command.GenerateBatchNarrationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GenerateBatchNarrationUseCase {
  private final GenerateChapterNarrationUseCase generateChapterNarrationUseCase;

  public List<ChapterNarrationJob> execute(GenerateBatchNarrationCommand command) {
    var uniqueChapterIds = new LinkedHashSet<>(command.chapterIds());
    if (uniqueChapterIds.size() != command.chapterIds().size()) {
      throw new IllegalArgumentException("chapterIds must not contain duplicates");
    }
    return uniqueChapterIds.stream()
        .map(
            chapterId -> {
              GenerationJob job =
                  generateChapterNarrationUseCase.execute(
                      new GenerateChapterNarrationCommand(
                          command.projectId(),
                          chapterId,
                          command.voiceId(),
                          command.speakingRate(),
                          command.voiceReferenceAssetId()));
              return new ChapterNarrationJob(chapterId, job);
            })
        .toList();
  }

  public record ChapterNarrationJob(UUID chapterId, GenerationJob job) {}
}
