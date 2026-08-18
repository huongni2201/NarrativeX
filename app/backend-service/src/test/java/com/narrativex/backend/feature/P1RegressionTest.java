package com.narrativex.backend.feature;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.exception.InvalidStoryVersionTransitionException;
import org.junit.jupiter.api.Test;

class P1RegressionTest {

  @Test
  void storyAnalysisMustFailClosedUntilDurableExecutionControlsExist() {
    var useCase = new EnqueueStoryAnalysisUseCase();

    assertThrows(FeatureNotAvailableException.class, () -> useCase.execute(null));
  }

  @Test
  void invalidStoryVersionTransitionIsADomainConflict() {
    var version = StoryVersion.create(1L, 1, "story", "vi");
    version.activate();

    assertThrows(InvalidStoryVersionTransitionException.class, version::activate);
  }
}
