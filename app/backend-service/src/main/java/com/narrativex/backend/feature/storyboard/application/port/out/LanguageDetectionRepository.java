package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetection;
import java.util.Optional;
import java.util.UUID;

public interface LanguageDetectionRepository {
  LanguageDetection save(LanguageDetection detection);

  Optional<LanguageDetection> findLatest(UUID contentVariantId, String contentHash);
}
