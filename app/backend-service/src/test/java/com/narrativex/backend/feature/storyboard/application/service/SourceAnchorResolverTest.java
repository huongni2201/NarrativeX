package com.narrativex.backend.feature.storyboard.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class SourceAnchorResolverTest {
  private static final String SOURCE = "😀 He said: Hello. She smiled. They left. The end.";
  private final SourceAnchorResolver resolver = new SourceAnchorResolver();
  private final SourceAnchorResolver.SourceUnits units = resolver.units(SOURCE, null);

  @Test
  void beatsTileTheChapterFromTheirStartUnits() {
    var beats = resolver.resolveBeats(units, List.of(0, 2));
    assertEquals(2, beats.size());
    assertEquals(0, beats.get(0).textStart());
    assertEquals(units.units().get(1).end(), beats.get(0).textEnd());
    assertEquals(units.units().get(2).start(), beats.get(1).textStart());
    assertEquals(units.units().get(3).end(), beats.get(1).textEnd());
    assertEquals(1, beats.get(0).lastUnit());
    assertEquals(beats.get(0).lastUnit() + 1, beats.get(1).firstUnit());
  }

  @Test
  void theFirstBeatAlwaysStartsAtTheChapterStartLikeTheProductionClock() {
    var beats = resolver.resolveBeats(units, List.of(2, 3));
    assertEquals(0, beats.get(0).textStart());
    assertEquals(0, beats.get(0).firstUnit());
  }

  @Test
  void serializesTheRangeAndSourceHash() throws Exception {
    var beat = resolver.resolveBeats(units, List.of(0)).get(0);
    var json = JsonMapper.builder().build().readTree(beat.sourceAnchorJson());
    assertEquals(beat.textStart(), json.get("textStart").asInt());
    assertEquals(beat.textEnd(), json.get("textEnd").asInt());
    assertEquals(units.sourceHash(), json.get("sourceHash").asText());
    assertTrue(units.sourceHash().matches("[0-9a-f]{64}"));
  }

  @Test
  void usesTheGivenSourceHashWhenItIsValid() {
    assertEquals("a".repeat(64), resolver.units(SOURCE, "a".repeat(64)).sourceHash());
  }

  @Test
  void failsClosedForOutOfRangeOrNonAdvancingStarts() {
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveBeats(units, List.of(0, 9)));
    assertThrows(
        IllegalArgumentException.class, () -> resolver.resolveBeats(units, List.of(0, -1)));
    assertThrows(
        IllegalArgumentException.class, () -> resolver.resolveBeats(units, List.of(0, 2, 2)));
    assertThrows(
        IllegalArgumentException.class, () -> resolver.resolveBeats(units, List.of(0, 3, 1)));
    assertThrows(IllegalArgumentException.class, () -> resolver.resolveBeats(units, List.of()));
  }

  @Test
  void rangeCoversInclusiveUnitsAndRejectsInvalidOnes() {
    var range = resolver.range(units, 1, 2);
    assertEquals(units.units().get(1).start(), range.textStart());
    assertEquals(units.units().get(2).end(), range.textEnd());
    assertThrows(IllegalArgumentException.class, () -> resolver.range(units, 2, 1));
    assertThrows(IllegalArgumentException.class, () -> resolver.range(units, 0, 99));
  }

  @Test
  void rejectsBlankSource() {
    assertThrows(IllegalArgumentException.class, () -> resolver.units(" ", null));
  }
}
