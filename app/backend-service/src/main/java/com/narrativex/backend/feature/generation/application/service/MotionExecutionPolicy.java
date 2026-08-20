package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.ExecutionContext;
import com.narrativex.backend.feature.generation.domain.value.ResolvedMotionExecution;

public interface MotionExecutionPolicy {
  ResolvedMotionExecution authorizeMotion(
      boolean imageToVideoEligible, ProductionMode mode, ExecutionContext context);
}
