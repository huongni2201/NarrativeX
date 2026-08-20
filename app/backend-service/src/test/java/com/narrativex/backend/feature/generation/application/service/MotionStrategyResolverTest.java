package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.ExecutionContext;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import org.junit.jupiter.api.Test;

class MotionStrategyResolverTest {
  private final MotionStrategyResolver resolver =
      new MotionStrategyResolver(new DefaultMotionExecutionPolicy());

  @Test
  void imageMotionNeverEscalatesToI2v() {
    assertThat(resolver.resolve(ProductionMode.IMAGE_MOTION, MotionIntent.STILL))
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
    assertThat(resolver.resolve(ProductionMode.IMAGE_MOTION, MotionIntent.BASIC_MOTION))
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
    assertThat(resolver.resolve(ProductionMode.IMAGE_MOTION, MotionIntent.AI_VIDEO))
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
  }

  @Test
  void hybridUsesI2vOnlyForExplicitAiVideoIntent() {
    assertThat(resolver.resolve(ProductionMode.HYBRID_LOCAL_I2V, MotionIntent.STILL))
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
    assertThat(resolver.resolve(ProductionMode.HYBRID_LOCAL_I2V, MotionIntent.BASIC_MOTION))
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
    assertThat(resolver.resolve(ProductionMode.HYBRID_LOCAL_I2V, MotionIntent.AI_VIDEO))
        .isEqualTo(MotionStrategy.IMAGE_TO_VIDEO);
  }

  @Test
  void hybridProviderFailureFallsBackThroughBackendPolicy() {
    ExecutionContext unavailableProvider =
        new ExecutionContext(false, false, true, true, true, 0, 3);

    assertThat(
            resolver.resolve(
                ProductionMode.HYBRID_LOCAL_I2V,
                MotionIntent.AI_VIDEO,
                unavailableProvider))
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
  }
}
