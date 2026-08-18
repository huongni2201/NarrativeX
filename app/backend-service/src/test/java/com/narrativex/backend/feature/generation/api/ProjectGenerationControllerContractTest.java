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
  void disabledStoryAnalysisDoesNotCreateAQueuedJob() {
    EnqueueStoryAnalysisUseCase useCase = mock(EnqueueStoryAnalysisUseCase.class);
    ProjectGenerationController controller = new ProjectGenerationController(useCase, false);

    assertThrows(FeatureNotAvailableException.class, () -> controller.analyze(7L));
    verifyNoInteractions(useCase);
  }
}
