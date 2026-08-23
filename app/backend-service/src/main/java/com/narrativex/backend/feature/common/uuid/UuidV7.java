package com.narrativex.backend.feature.common.uuid;

import com.github.f4b6a3.uuid.UuidCreator;
import java.util.Objects;
import java.util.UUID;

/** Small UUIDv7 facade that keeps the rest of the application on java.util.UUID. */
public final class UuidV7 {
  private UuidV7() {}

  /** Creates a new time-ordered UUIDv7. */
  public static UUID random() {
    return UuidCreator.getTimeOrderedEpoch();
  }

  /** Formats a UUIDv7 using the canonical UUID representation. */
  public static String toString(UUID value) {
    return requireV7(value).toString();
  }

  /** Parses a canonical UUID string and rejects UUIDs from another version. */
  public static UUID fromString(String value) {
    UUID uuid = UUID.fromString(Objects.requireNonNull(value, "value must not be null"));
    return requireV7(uuid);
  }

  public static boolean isV7(UUID value) {
    return value != null && value.version() == 7 && value.variant() == 2;
  }

  private static UUID requireV7(UUID value) {
    Objects.requireNonNull(value, "value must not be null");
    if (!isV7(value)) {
      throw new IllegalArgumentException("UUID must be RFC 9562 version 7");
    }
    return value;
  }
}
