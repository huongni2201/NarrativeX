package com.narrativex.backend.feature.project.application.service;

import com.narrativex.backend.feature.common.application.TextInputEstimator;

/** Backward-compatible project facade for conservative story input estimation. */
public final class StoryInputEstimator {
  private StoryInputEstimator() {}

  public static int estimateTokensConservatively(String content) {
    return TextInputEstimator.estimateTokensConservatively(content);
  }
}
