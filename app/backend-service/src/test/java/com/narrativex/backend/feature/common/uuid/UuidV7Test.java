package com.narrativex.backend.feature.common.uuid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class UuidV7Test {
  @Test
  void randomCreatesUuidV7() {
    UUID value = UuidV7.random();

    assertTrue(UuidV7.isV7(value));
    assertEquals(7, value.version());
    assertEquals(2, value.variant());
  }

  @Test
  void stringRoundTripPreservesUuid() {
    UUID value = UuidV7.random();

    assertEquals(value, UuidV7.fromString(UuidV7.toString(value)));
  }

  @Test
  void fromStringRejectsNonV7Uuid() {
    assertThrows(
        IllegalArgumentException.class, () -> UuidV7.fromString(UUID.randomUUID().toString()));
  }
}
