package com.narrativex.backend.feature.storyboard.application.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.stereotype.Component;

@Component
public class ChapterSourceHasher {

  public NormalizedSource normalizeAndHash(String sourceText) {
    if (sourceText == null) {
      throw new IllegalArgumentException("sourceText must not be null");
    }
    String normalized = sourceText.replace("\r\n", "\n").replace('\r', '\n');
    return new NormalizedSource(normalized, sha256Hex(normalized));
  }

  private static String sha256Hex(String value) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }

  public record NormalizedSource(String text, String hash) {}
}
