package com.narrativex.backend.feature.assets.application.pagination;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

public final class MediaAssetCursorCodec {
  private static final String SEPARATOR = "|";

  private MediaAssetCursorCodec() {}

  public static String encode(MediaAssetCursor cursor) {
    String value = cursor.createdAt() + SEPARATOR + cursor.id();
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }

  public static MediaAssetCursor decode(String encoded) {
    if (encoded == null || encoded.isBlank()) return null;
    try {
      String decoded =
          new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
      int separatorIndex = decoded.lastIndexOf(SEPARATOR);
      if (separatorIndex <= 0 || separatorIndex == decoded.length() - 1) {
        throw new IllegalArgumentException("Malformed cursor");
      }
      return new MediaAssetCursor(
          Instant.parse(decoded.substring(0, separatorIndex)),
          UUID.fromString(decoded.substring(separatorIndex + 1)));
    } catch (RuntimeException exception) {
      throw new DomainValidationException("Invalid pagination cursor", exception);
    }
  }
}
