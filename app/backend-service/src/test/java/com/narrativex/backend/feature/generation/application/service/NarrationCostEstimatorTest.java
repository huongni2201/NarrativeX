package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class NarrationCostEstimatorTest {
  private final NarrationCostEstimator estimator = new NarrationCostEstimator();

  @Test
  void localExecutionHasZeroExternalApiAuthorizationCost() {
    var estimate = estimator.estimate("Xin chào NarrativeX", true);

    assertThat(estimate.estimateMin()).isEqualByComparingTo(BigDecimal.ZERO);
    assertThat(estimate.estimateMax()).isEqualByComparingTo(BigDecimal.ZERO);
    assertThat(estimate.maxAuthorizedCost()).isEqualByComparingTo(BigDecimal.ZERO);
    assertThat(estimate.characters()).isPositive();
  }

  @Test
  void externalExecutionRetainsConservativeAuthorizationCeiling() {
    var estimate = estimator.estimate("a".repeat(2_000), false);

    assertThat(estimate.estimateMax()).isEqualByComparingTo("0.320000");
    assertThat(estimate.maxAuthorizedCost()).isEqualByComparingTo("0.400000");
  }
}
