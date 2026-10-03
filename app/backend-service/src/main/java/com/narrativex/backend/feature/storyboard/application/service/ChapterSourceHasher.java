package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.common.hashing.Sha256;
import org.springframework.stereotype.Component;

@Component
public class ChapterSourceHasher {

  public NormalizedSource normalizeAndHash(String sourceText) {
    if (sourceText == null) {
      throw new IllegalArgumentException("sourceText must not be null");
    }
    String normalized = sourceText.replace("\r\n", "\n").replace('\r', '\n');
    return new NormalizedSource(normalized, Sha256.hexUtf8(normalized));
  }

  public record NormalizedSource(String text, String hash) {}
}
