package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetection;
import java.util.Optional;

public interface LanguageDetectionRepository {
  LanguageDetection save(LanguageDetection detection);

  Optional<LanguageDetection> findLatest(Long contentVariantId, String contentHash);
}
