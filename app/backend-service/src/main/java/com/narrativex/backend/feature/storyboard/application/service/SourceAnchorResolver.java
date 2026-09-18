package com.narrativex.backend.feature.storyboard.application.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Deterministically resolves ordered VisualBeat source_anchor strings to UTF-16 text ranges.
 *
 * Follows strict ADR-0015 and compute protocol rules:
 * 1. Exact verbatim source substrings.
 * 2. Strict beat-order resolution.
 * 3. Repeated text advances monotonically without re-consuming earlier occurrences.
 * 4. Prefer the next occurrence at or after previous beat end.
 * 5. Fails closed (throws IllegalArgumentException) if any anchor cannot be deterministically resolved.
 * 6. Offsets match Java/JS UTF-16 code unit semantics.
 * 7. Validates 0 <= textStart < textEnd <= normalizedSource.length().
 * 8. Serializes deterministic sourceAnchorJson containing textStart, textEnd, and sourceHash.
 */
@Component
public class SourceAnchorResolver {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final Pattern SHA256_HEX_PATTERN = Pattern.compile("^[0-9a-f]{64}$");

  public record ResolvedSourceAnchor(
      int textStart, int textEnd, String sourceHash, String sourceAnchorJson) {}

  public List<ResolvedSourceAnchor> resolveAll(
      String sourceText, String sourceHash, List<String> orderedAnchors) {
    if (sourceText == null || sourceText.isBlank()) {
      throw new IllegalArgumentException("sourceText must not be null or blank");
    }
    if (orderedAnchors == null || orderedAnchors.isEmpty()) {
      throw new IllegalArgumentException("orderedAnchors must not be null or empty");
    }

    String normalizedSource = normalizeCrlf(sourceText);
    String effectiveSourceHash = resolveSourceHash(normalizedSource, sourceHash);

    List<ResolvedSourceAnchor> resolved = new ArrayList<>(orderedAnchors.size());
    int searchCursor = 0;

    for (int i = 0; i < orderedAnchors.size(); i++) {
      String rawAnchor = orderedAnchors.get(i);
      if (rawAnchor == null || rawAnchor.isBlank()) {
        throw new IllegalArgumentException(
            "source_anchor at index " + i + " must not be null or blank");
      }
      String normalizedAnchor = normalizeCrlf(rawAnchor);
      int textStart = normalizedSource.indexOf(normalizedAnchor, searchCursor);
      if (textStart < 0) {
        throw new IllegalArgumentException(
            "Cannot resolve source_anchor deterministically in order at beat index "
                + i
                + " (searchCursor="
                + searchCursor
                + "): anchor \""
                + (rawAnchor.length() > 60 ? rawAnchor.substring(0, 60) + "..." : rawAnchor)
                + "\" not found at or after previous beat");
      }

      int textEnd = textStart + normalizedAnchor.length();
      if (textStart < 0 || textEnd <= textStart || textEnd > normalizedSource.length()) {
        throw new IllegalArgumentException(
            "Invalid resolved text range for anchor at beat index "
                + i
                + ": ["
                + textStart
                + ", "
                + textEnd
                + "]");
      }

      if (!normalizedSource.substring(textStart, textEnd).equals(normalizedAnchor)) {
        throw new IllegalArgumentException(
            "Resolved range does not match anchor verbatim at beat index " + i);
      }

      String sourceAnchorJson = buildSourceAnchorJson(textStart, textEnd, effectiveSourceHash);
      resolved.add(
          new ResolvedSourceAnchor(textStart, textEnd, effectiveSourceHash, sourceAnchorJson));
      searchCursor = textEnd;
    }

    return resolved;
  }

  public String buildSourceAnchorJson(int textStart, int textEnd, String sourceHash) {
    if (textStart < 0 || textEnd <= textStart) {
      throw new IllegalArgumentException(
          "Invalid text range: [" + textStart + ", " + textEnd + "]");
    }
    if (sourceHash == null || !SHA256_HEX_PATTERN.matcher(sourceHash).matches()) {
      throw new IllegalArgumentException("sourceHash must be a 64-character lowercase hex string");
    }
    try {
      return JSON.writeValueAsString(new SourceAnchorJsonPayload(textStart, textEnd, sourceHash));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to serialize source_anchor_json", e);
    }
  }

  private static String normalizeCrlf(String text) {
    return text.replace("\r\n", "\n").replace('\r', '\n');
  }

  private static String resolveSourceHash(String normalizedSource, String sourceHash) {
    if (sourceHash != null && SHA256_HEX_PATTERN.matcher(sourceHash).matches()) {
      return sourceHash;
    }
    return sha256Hex(normalizedSource);
  }

  private static String sha256Hex(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }

  private record SourceAnchorJsonPayload(int textStart, int textEnd, String sourceHash) {}
}
