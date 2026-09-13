package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import java.util.Objects;
import org.springframework.stereotype.Component;

/** Maps editor motion intent to the currently supported backend production strategy. */
@Component
public class MotionStrategyResolver {
  public MotionStrategy resolve(ProductionMode productionMode, MotionIntent motionIntent) {
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(motionIntent, "motionIntent");
    return switch (productionMode) {
      case IMAGE_MOTION -> MotionStrategy.BASIC_IMAGE_MOTION;
    };
  }
}
