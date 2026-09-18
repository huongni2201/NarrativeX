package com.narrativex.backend.feature.storyboard.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class SourceAnchorResolverTest {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private SourceAnchorResolver resolver;

  @BeforeEach
  void setUp() {
    resolver = new SourceAnchorResolver();
  }

  @Test
  @DisplayName("Resolves a single anchor with correct UTF-16 offsets and JSON format")
  void resolvesSingleAnchor() throws Exception {
    String source = "Once upon a time in a faraway kingdom, there lived an ancient king.";
    String anchor = "faraway kingdom";

    var results = resolver.resolveAll(source, null, List.of(anchor));

    assertEquals(1, results.size());
    var resolved = results.get(0);
    int expectedStart = source.indexOf(anchor);
    int expectedEnd = expectedStart + anchor.length();
    assertEquals(expectedStart, resolved.textStart());
    assertEquals(expectedEnd, resolved.textEnd());
    assertEquals(source.substring(resolved.textStart(), resolved.textEnd()), anchor);

    JsonNode json = JSON.readTree(resolved.sourceAnchorJson());
    assertEquals(expectedStart, json.get("textStart").asInt());
    assertEquals(expectedEnd, json.get("textEnd").asInt());
    assertNotNull(json.get("sourceHash").asText());
    assertTrue(json.get("sourceHash").asText().matches("^[0-9a-f]{64}$"));
  }

  @Test
  @DisplayName("Resolves multiple distinct anchors in sequential order")
  void resolvesMultipleDistinctAnchorsInOrder() {
    String source = "Part one begins here. Then part two follows. Finally part three concludes.";
    List<String> anchors = List.of("Part one", "part two", "part three");

    var results = resolver.resolveAll(source, null, anchors);

    assertEquals(3, results.size());
    assertTrue(results.get(0).textStart() < results.get(0).textEnd());
    assertTrue(results.get(0).textEnd() <= results.get(1).textStart());
    assertTrue(results.get(1).textEnd() <= results.get(2).textStart());

    for (int i = 0; i < anchors.size(); i++) {
      assertEquals(
          anchors.get(i),
          source.substring(results.get(i).textStart(), results.get(i).textEnd()));
    }
  }

  @Test
  @DisplayName("Resolves duplicate identical anchors deterministically without re-consuming earlier occurrence")
  void resolvesDuplicateIdenticalAnchorsDeterministically() {
    String source = "The bell tolls. Quiet settles. The bell tolls once more for all.";
    String anchor = "The bell tolls";
    List<String> anchors = List.of(anchor, anchor);

    var results = resolver.resolveAll(source, null, anchors);

    assertEquals(2, results.size());
    assertEquals(0, results.get(0).textStart());
    assertEquals(14, results.get(0).textEnd());

    int secondExpectedStart = source.indexOf(anchor, 14);
    assertEquals(secondExpectedStart, results.get(1).textStart());
    assertEquals(secondExpectedStart + anchor.length(), results.get(1).textEnd());
    assertTrue(results.get(1).textStart() >= results.get(0).textEnd());
  }

  @Test
  @DisplayName("Fails closed when an anchor appears earlier than search cursor (out of order)")
  void failsClosedWhenAnchorsAreOutOfOrder() {
    String source = "First chapter summary. Middle chapter event. Early prologue note.";
    // "Middle chapter" appears before "Early prologue note", so requesting "Middle chapter" then "First chapter" is out of order
    List<String> anchors = List.of("Middle chapter event", "First chapter summary");

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class, () -> resolver.resolveAll(source, null, anchors));
    assertTrue(ex.getMessage().contains("Cannot resolve source_anchor deterministically"));
  }

  @Test
  @DisplayName("Fails closed when an anchor is not found in source text")
  void failsClosedWhenAnchorNotFound() {
    String source = "Simple story with predictable words.";
    List<String> anchors = List.of("dragon breathes fire");

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class, () -> resolver.resolveAll(source, null, anchors));
    assertTrue(ex.getMessage().contains("Cannot resolve source_anchor deterministically"));
  }

  @Test
  @DisplayName("Correctly calculates UTF-16 offsets for Vietnamese Unicode text")
  void resolvesVietnameseUnicodeOffsets() {
    String source = "Trời mưa tầm tã trên con phố cổ. Tiếng sấm rền vang giữa màn đêm tĩnh mịch.";
    List<String> anchors = List.of("Trời mưa tầm tã", "phố cổ", "Tiếng sấm rền vang", "tĩnh mịch");

    var results = resolver.resolveAll(source, null, anchors);

    assertEquals(4, results.size());
    for (int i = 0; i < anchors.size(); i++) {
      assertEquals(
          anchors.get(i),
          source.substring(results.get(i).textStart(), results.get(i).textEnd()));
    }
  }

  @Test
  @DisplayName("Correctly calculates UTF-16 code unit offsets with surrogate pairs / emoji")
  void resolvesEmojiSurrogatePairOffsetsCorrectly() {
    // 🚀 is U+1F680 (2 UTF-16 code units: \uD83D\uDE80)
    // 🌟 is U+1F31F (2 UTF-16 code units: \uD83D\uDF1F)
    String source = "Tàu vũ trụ 🚀 cất cánh vào không gian 🌟 rực rỡ!";
    List<String> anchors = List.of("Tàu vũ trụ 🚀", "không gian 🌟 rực rỡ");

    var results = resolver.resolveAll(source, null, anchors);

    assertEquals(2, results.size());
    assertEquals(0, results.get(0).textStart());
    assertEquals("Tàu vũ trụ 🚀".length(), results.get(0).textEnd());
    assertEquals("Tàu vũ trụ 🚀", source.substring(results.get(0).textStart(), results.get(0).textEnd()));

    int secondExpectedStart = source.indexOf("không gian 🌟 rực rỡ");
    assertEquals(secondExpectedStart, results.get(1).textStart());
    assertEquals("không gian 🌟 rực rỡ", source.substring(results.get(1).textStart(), results.get(1).textEnd()));
  }

  @Test
  @DisplayName("Normalizes CRLF and LF transparently")
  void normalizesCrlfAndLf() {
    String source = "Line one.\r\nLine two.\r\nLine three.";
    List<String> anchors = List.of("Line one.", "Line two.", "Line three.");

    var results = resolver.resolveAll(source, null, anchors);

    assertEquals(3, results.size());
    for (var r : results) {
      assertTrue(r.textStart() >= 0);
      assertTrue(r.textEnd() > r.textStart());
    }
  }

  @Test
  @DisplayName("Fails closed on null, empty, or blank inputs")
  void failsClosedOnInvalidInputs() {
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveAll(null, null, List.of("a")));
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveAll(" ", null, List.of("a")));
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveAll("valid", null, null));
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveAll("valid", null, List.of()));
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveAll("valid", null, List.of("")));
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveAll("valid", null, List.of("   ")));
  }
}
