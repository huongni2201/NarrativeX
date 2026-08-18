package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import org.junit.jupiter.api.Test;

class EnqueueStoryAnalysisUseCaseTest {

  @Test
  void chapterAnalysisMustFailClosedUntilDurableExecutionControlsExist() {
    var useCase = new EnqueueStoryAnalysisUseCase();

    assertThrows(
        FeatureNotAvailableException.class,
        () -> useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L)));
  }

  @Test
  void analysisCommandRequiresAValidProjectAndChapterScope() {
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(null, 11L));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(7L, null));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(0L, 11L));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(7L, 0L));
  }
}
