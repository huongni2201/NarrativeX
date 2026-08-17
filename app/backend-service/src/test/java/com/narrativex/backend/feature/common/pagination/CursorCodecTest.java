package com.narrativex.backend.feature.common.pagination;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CursorCodecTest {
  @Test
  void encodesAndDecodesStableKeyset() {
    Instant updatedAt = Instant.parse("2026-08-18T12:34:56.123456Z");

    String cursor = CursorCodec.encode(updatedAt, 42L);
    CursorKey decoded = CursorCodec.decode(cursor);

    assertEquals(updatedAt, decoded.updatedAt());
    assertEquals(42L, decoded.id());
  }

  @Test
  void rejectsMalformedCursor() {
    assertThrows(DomainValidationException.class, () -> CursorCodec.decode("not-a-valid-cursor"));
  }
}
