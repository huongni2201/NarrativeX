package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import org.junit.jupiter.api.Test;

class EnqueueStoryAnalysisUseCaseTest {

  @Test
  void storyAnalysisMustFailClosedUntilDurableExecutionControlsExist() {
    var useCase = new EnqueueStoryAnalysisUseCase();

    assertThrows(
        FeatureNotAvailableException.class,
        () -> useCase.execute(new EnqueueStoryAnalysisCommand(7L, "owner")));
  }
}

