package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.generation.application.command.GenerateBatchNarrationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GenerateBatchNarrationUseCase {
  private final GenerateChapterNarrationUseCase generateChapterNarrationUseCase;

  /**
   * Each chapter owns its own transaction in GenerateChapterNarrationUseCase. This intentionally
   * avoids wrapping the whole batch in one transaction: once the account's concurrent expensive-job
   * capacity is full, already accepted chapters stay committed and can be processed by workers.
   */
  public List<ChapterNarrationJob> execute(GenerateBatchNarrationCommand command) {
    var uniqueChapterIds = new LinkedHashSet<>(command.chapterIds());
    if (uniqueChapterIds.size() != command.chapterIds().size()) {
      throw new IllegalArgumentException("chapterIds must not contain duplicates");
    }

    List<ChapterNarrationJob> accepted = new ArrayList<>();
    for (UUID chapterId : uniqueChapterIds) {
      try {
        GenerationJob job =
            generateChapterNarrationUseCase.execute(
                new GenerateChapterNarrationCommand(
                    command.projectId(),
                    chapterId,
                    command.voiceId(),
                    command.speakingRate(),
                    command.voiceReference()));
        accepted.add(new ChapterNarrationJob(chapterId, job));
      } catch (GenerationAdmissionDeniedException exception) {
        if (!accepted.isEmpty() && "COST_LIMIT".equals(exception.getCode())) {
          break;
        }
        throw exception;
      }
    }
    return List.copyOf(accepted);
  }

  public record ChapterNarrationJob(UUID chapterId, GenerationJob job) {}
}
