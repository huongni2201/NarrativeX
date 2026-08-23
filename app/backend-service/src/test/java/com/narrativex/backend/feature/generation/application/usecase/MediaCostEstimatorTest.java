package com.narrativex.backend.feature.generation.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class MediaCostEstimatorTest {
  @Test
  void estimatesStandardCostFromVisualBeatCount() {
    assertEquals("0.250000", MediaCostEstimator.unitCost("STANDARD").setScale(6).toPlainString());
    assertEquals("3.250000", MediaCostEstimator.estimate("STANDARD", 13).toPlainString());
  }
}
