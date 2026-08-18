package com.narrativex.backend.feature.project.application.service;

/** Cheap, deliberately conservative preflight estimator. Providers must still enforce real token limits. */
public final class StoryInputEstimator {
  private StoryInputEstimator() {}

  public static int estimateTokensConservatively(String content) {
    if (content == null || content.isEmpty()) return 1;

    long asciiCodePoints = 0;
    long nonAsciiCodePoints = 0;
    for (int offset = 0; offset < content.length(); ) {
      int codePoint = content.codePointAt(offset);
      if (codePoint <= 0x7F) asciiCodePoints++;
      else nonAsciiCodePoints++;
      offset += Character.charCount(codePoint);
    }

    long estimate = ((asciiCodePoints + 3L) / 4L) + nonAsciiCodePoints;
    return (int) Math.min(Integer.MAX_VALUE, Math.max(1L, estimate));
  }
}
