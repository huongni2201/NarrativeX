package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.MotionExecutionDecision;
import com.narrativex.backend.feature.generation.domain.enums.MotionFallbackReason;

public record ResolvedMotionExecution(
    MotionExecutionDecision decision, MotionFallbackReason fallbackReason) {
  public static ResolvedMotionExecution basic(MotionFallbackReason reason) {
    return new ResolvedMotionExecution(MotionExecutionDecision.BASIC_IMAGE_MOTION, reason);
  }

  public static ResolvedMotionExecution imageToVideo() {
    return new ResolvedMotionExecution(MotionExecutionDecision.IMAGE_TO_VIDEO, null);
  }
}
