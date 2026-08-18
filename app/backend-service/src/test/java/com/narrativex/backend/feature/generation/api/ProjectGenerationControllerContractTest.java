package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.api.controller.ProjectGenerationController;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import org.junit.jupiter.api.Test;

class ProjectGenerationControllerContractTest {
  @Test
  void disabledChapterAnalysisDoesNotCreateAQueuedJob() {
    EnqueueStoryAnalysisUseCase useCase = mock(EnqueueStoryAnalysisUseCase.class);
    ProjectGenerationController controller = new ProjectGenerationController(useCase, false);

    assertThrows(FeatureNotAvailableException.class, () -> controller.analyzeChapter(7L, 11L));
    verifyNoInteractions(useCase);
  }
}
