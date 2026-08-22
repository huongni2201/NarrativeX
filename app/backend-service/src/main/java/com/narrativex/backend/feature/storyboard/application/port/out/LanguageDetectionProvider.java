package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetectionResult;

public interface LanguageDetectionProvider {
  LanguageDetectionResult detect(String content);
}
