package com.narrativex.backend.feature.project.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class StoryInputEstimatorTest {
  @Test
  void estimatesAsciiAtAboutFourCharactersPerToken() {
    assertEquals(3, StoryInputEstimator.estimateTokensConservatively("hello world"));
  }

  @Test
  void treatsNonAsciiCodePointsConservatively() {
    String cjk = "你好世界";
    assertEquals(4, StoryInputEstimator.estimateTokensConservatively(cjk));
  }

  @Test
  void multilingualEstimateDoesNotUnderCountEveryNonAsciiCharacter() {
    String vietnamese = "Truyện cổ tích ở Hà Nội";
    assertTrue(StoryInputEstimator.estimateTokensConservatively(vietnamese) >= 6);
  }
}
