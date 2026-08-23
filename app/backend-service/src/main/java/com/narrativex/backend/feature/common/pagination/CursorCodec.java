package com.narrativex.backend.feature.common.pagination;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

public final class CursorCodec {
  private static final String SEPARATOR = "|";

  private CursorCodec() {}

  public static String encode(Instant updatedAt, long id) {
    return encodeRaw(updatedAt + SEPARATOR + id);
  }

  public static String encode(Instant updatedAt, UUID id) {
    if (updatedAt == null) throw new IllegalArgumentException("updatedAt must not be null");
    if (id == null) throw new IllegalArgumentException("id must not be null");
    return encodeRaw(updatedAt + SEPARATOR + id);
  }

  public static String encode(int orderIndex, long id) {
    return encodeRaw(orderIndex + SEPARATOR + id);
  }

  public static String encode(int orderIndex, UUID id) {
    if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");
    if (id == null) throw new IllegalArgumentException("id must not be null");
    return encodeRaw(orderIndex + SEPARATOR + id);
  }

  public static CursorKey decode(String cursor) {
    if (cursor == null || cursor.isBlank()) {
      return null;
    }

    try {
      String decoded = decodeRaw(cursor);
      int separatorIndex = separatorIndex(decoded);
      Instant updatedAt = Instant.parse(decoded.substring(0, separatorIndex));
      long id = Long.parseLong(decoded.substring(separatorIndex + 1));
      return new CursorKey(updatedAt, id);
    } catch (RuntimeException exception) {
      throw invalidCursor(exception);
    }
  }

  public static UuidCursorKey decodeUuid(String cursor) {
    if (cursor == null || cursor.isBlank()) {
      return null;
    }

    try {
      String decoded = decodeRaw(cursor);
      int separatorIndex = separatorIndex(decoded);
      Instant updatedAt = Instant.parse(decoded.substring(0, separatorIndex));
      UUID id = UUID.fromString(decoded.substring(separatorIndex + 1));
      return new UuidCursorKey(updatedAt, id);
    } catch (RuntimeException exception) {
      throw invalidCursor(exception);
    }
  }

  public static OrderIndexCursorKey decodeOrderIndex(String cursor) {
    if (cursor == null || cursor.isBlank()) {
      return null;
    }

    try {
      String decoded = decodeRaw(cursor);
      int separatorIndex = separatorIndex(decoded);
      int orderIndex = Integer.parseInt(decoded.substring(0, separatorIndex));
      long id = Long.parseLong(decoded.substring(separatorIndex + 1));
      return new OrderIndexCursorKey(orderIndex, id);
    } catch (RuntimeException exception) {
      throw invalidCursor(exception);
    }
  }

  public static OrderIndexUuidCursorKey decodeOrderIndexUuid(String cursor) {
    if (cursor == null || cursor.isBlank()) {
      return null;
    }

    try {
      String decoded = decodeRaw(cursor);
      int separatorIndex = separatorIndex(decoded);
      int orderIndex = Integer.parseInt(decoded.substring(0, separatorIndex));
      UUID id = UUID.fromString(decoded.substring(separatorIndex + 1));
      return new OrderIndexUuidCursorKey(orderIndex, id);
    } catch (RuntimeException exception) {
      throw invalidCursor(exception);
    }
  }

  private static String encodeRaw(String value) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }

  private static String decodeRaw(String cursor) {
    return new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
  }

  private static int separatorIndex(String decoded) {
    int separatorIndex = decoded.lastIndexOf(SEPARATOR);
    if (separatorIndex <= 0 || separatorIndex == decoded.length() - 1) {
      throw new IllegalArgumentException("Malformed cursor");
    }
    return separatorIndex;
  }

  private static DomainValidationException invalidCursor(RuntimeException exception) {
    return new DomainValidationException("Invalid pagination cursor", exception);
  }
}
