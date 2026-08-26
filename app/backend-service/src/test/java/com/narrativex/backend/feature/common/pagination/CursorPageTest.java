package com.narrativex.backend.feature.common.pagination;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;

class CursorPageTest {
  @Test
  void mapsContentAndRetainsCursorMetadata() {
    var page = new CursorPage<>(List.of("first", "second"), "next-page", 2, true);

    CursorPage<Integer> mapped = page.map(String::length);

    assertEquals(List.of(5, 6), mapped.content());
    assertEquals("next-page", mapped.nextCursor());
    assertEquals(2, mapped.limit());
    assertEquals(true, mapped.hasNext());
  }

  @Test
  void rejectsCursorWhenThereIsNoNextPage() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new CursorPage<>(List.of("only"), "unexpected", 1, false));
  }
}
