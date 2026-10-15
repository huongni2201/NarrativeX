package com.narrativex.backend.feature.generation.application.model.prompt;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.nio.charset.StandardCharsets;

/** Normalization and size rules shared by every editable prompt text field. */
final class PromptText {
  private PromptText() {}

  /** Normalizes line endings and surrounding whitespace so equal content hashes equally. */
  static String normalize(String value) {
    if (value == null) return "";
    return value.replace("\r\n", "\n").replace('\r', '\n').strip();
  }

  static int utf8Bytes(String value) {
    return value.getBytes(StandardCharsets.UTF_8).length;
  }

  static String required(String field, String value, int maxBytes) {
    String normalized = normalize(value);
    if (normalized.isEmpty()) {
      throw new DomainValidationException(field + ": must not be blank");
    }
    return bounded(field, normalized, maxBytes);
  }

  static String optional(String field, String value, int maxBytes) {
    return bounded(field, normalize(value), maxBytes);
  }

  private static String bounded(String field, String normalized, int maxBytes) {
    if (normalized.indexOf('\u0000') >= 0) {
      throw new DomainValidationException(field + ": must not contain NUL characters");
    }
    if (utf8Bytes(normalized) > maxBytes) {
      throw new DomainValidationException(field + ": exceeds " + maxBytes + " bytes (UTF-8)");
    }
    return normalized;
  }
}
