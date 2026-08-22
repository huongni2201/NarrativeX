package com.narrativex.backend.feature.storyboard.domain.value;

import java.math.BigDecimal;

public record LanguageDetectionResult(String detectedLanguage, BigDecimal confidence, String detector) {
  public boolean isMultilingual() {
    return "MULTILINGUAL".equals(detectedLanguage);
  }
}
