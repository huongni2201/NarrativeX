package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.MotionFallbackReason;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.ExecutionContext;
import com.narrativex.backend.feature.generation.domain.value.ResolvedMotionExecution;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class DefaultMotionExecutionPolicy implements MotionExecutionPolicy {
  @Override
  public ResolvedMotionExecution authorizeMotion(
      boolean imageToVideoEligible, ProductionMode mode, ExecutionContext context) {
    Objects.requireNonNull(mode, "mode");
    Objects.requireNonNull(context, "context");

    if (mode == ProductionMode.IMAGE_MOTION || !imageToVideoEligible) {
      return ResolvedMotionExecution.basic(null);
    }
    if (!context.providerAvailable()) {
      return ResolvedMotionExecution.basic(MotionFallbackReason.PROVIDER_UNAVAILABLE);
    }
    if (context.providerTimedOut()) {
      return ResolvedMotionExecution.basic(MotionFallbackReason.PROVIDER_TIMEOUT);
    }
    if (!context.gpuCapacityAvailable()) {
      return ResolvedMotionExecution.basic(MotionFallbackReason.GPU_CAPACITY);
    }
    if (!context.quotaAvailable()) {
      return ResolvedMotionExecution.basic(MotionFallbackReason.QUOTA_EXCEEDED);
    }
    if (!context.withinCostLimit()) {
      return ResolvedMotionExecution.basic(MotionFallbackReason.COST_LIMIT);
    }
    if (context.previousAttempts() >= context.maxAttempts()) {
      return ResolvedMotionExecution.basic(MotionFallbackReason.RETRY_EXHAUSTED);
    }
    return ResolvedMotionExecution.imageToVideo();
  }
}
