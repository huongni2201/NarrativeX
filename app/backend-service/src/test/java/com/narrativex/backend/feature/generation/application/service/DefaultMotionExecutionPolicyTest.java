package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.MotionExecutionDecision;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.ExecutionContext;
import org.junit.jupiter.api.Test;

class DefaultMotionExecutionPolicyTest {
  private final DefaultMotionExecutionPolicy policy = new DefaultMotionExecutionPolicy();

  @Test
  void imageMotionAlwaysAuthorizesBasicMotion() {
    var resolved =
        policy.authorizeMotion(true, ProductionMode.IMAGE_MOTION, ExecutionContext.mvp());

    assertThat(resolved.decision()).isEqualTo(MotionExecutionDecision.BASIC_IMAGE_MOTION);
    assertThat(resolved.fallbackReason()).isNull();
  }
}
