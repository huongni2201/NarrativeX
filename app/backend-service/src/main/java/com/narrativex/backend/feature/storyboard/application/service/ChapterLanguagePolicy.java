package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetection;

public final class ChapterLanguagePolicy {
  private ChapterLanguagePolicy() {}

  public static String translationStatus(LanguageDetection detection, String projectLanguage) {
    if (detection == null || detection.detectedLanguage().equals("UNKNOWN"))
      return "LANGUAGE_SELECTION_REQUIRED";
    if (detection.detectedLanguage().equals("MULTILINGUAL")) return "MULTILINGUAL";
    if (sameLanguage(detection.detectedLanguage(), projectLanguage)) return "NOT_REQUIRED";
    if (detection.confidence().doubleValue() >= 0.80d) return "PENDING_CONFIRMATION";
    return "LANGUAGE_SELECTION_REQUIRED";
  }

  public static boolean sameLanguage(String left, String right) {
    if (left == null || right == null) return false;
    return left.equalsIgnoreCase(right)
        || left.regionMatches(true, 0, right, 0, 2)
        || right.regionMatches(true, 0, left, 0, 2);
  }
}
