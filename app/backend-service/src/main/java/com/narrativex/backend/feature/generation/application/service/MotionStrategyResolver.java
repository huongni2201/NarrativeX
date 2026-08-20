package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.MotionExecutionDecision;
import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.ExecutionContext;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Resolves semantic/editor intent into an execution decision under backend execution policy. */
@Component
@RequiredArgsConstructor
public class MotionStrategyResolver {
  private final MotionExecutionPolicy executionPolicy;

  public MotionStrategy resolve(ProductionMode productionMode, MotionIntent motionIntent) {
    return resolve(productionMode, motionIntent, ExecutionContext.mvp());
  }

  public MotionStrategy resolve(
      ProductionMode productionMode, MotionIntent motionIntent, ExecutionContext context) {
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(motionIntent, "motionIntent");
    Objects.requireNonNull(context, "context");

    boolean imageToVideoEligible = motionIntent == MotionIntent.AI_VIDEO;
    var resolved =
        executionPolicy.authorizeMotion(imageToVideoEligible, productionMode, context);
    return resolved.decision() == MotionExecutionDecision.IMAGE_TO_VIDEO
        ? MotionStrategy.IMAGE_TO_VIDEO
        : MotionStrategy.BASIC_IMAGE_MOTION;
  }
}
