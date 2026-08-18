package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.api.controller.ProjectGenerationController;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import org.junit.jupiter.api.Test;

class ProjectGenerationControllerContractTest {
  @Test
  void chapterAnalysisIsExplicitlyUnavailableUntilDurableEnqueueExists() {
    ProjectGenerationController controller =
        new ProjectGenerationController(new EnqueueStoryAnalysisUseCase());

    assertThrows(FeatureNotAvailableException.class, () -> controller.analyzeChapter(7L, 11L));
  }
}
