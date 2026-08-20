package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import java.util.Objects;
import org.springframework.stereotype.Component;

/** Resolves semantic/editor intent into an execution decision under an authorized production mode. */
@Component
public class MotionStrategyResolver {

  public MotionStrategy resolve(ProductionMode productionMode, MotionIntent motionIntent) {
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(motionIntent, "motionIntent");

    if (productionMode == ProductionMode.IMAGE_MOTION) {
      return MotionStrategy.BASIC_IMAGE_MOTION;
    }

    return motionIntent == MotionIntent.AI_VIDEO
        ? MotionStrategy.IMAGE_TO_VIDEO
        : MotionStrategy.BASIC_IMAGE_MOTION;
  }
}
