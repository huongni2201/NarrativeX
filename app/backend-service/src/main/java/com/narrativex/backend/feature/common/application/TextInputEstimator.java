package com.narrativex.backend.feature.common.application;

/** Cheap, deliberately conservative preflight text estimator. Providers enforce real token limits. */
public final class TextInputEstimator {
  private TextInputEstimator() {}

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
