package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.service.NarrationTextClockMapper.TextRange;
import java.util.List;
import org.junit.jupiter.api.Test;

class NarrationTextClockMapperTest {
  @Test
  void mapsSemanticBeatStartsAcrossNarrationSpans() {
    String spans = """
        [
          {"textStart":0,"textEnd":50,"audioStartMs":0,"audioEndMs":5000},
          {"textStart":50,"textEnd":100,"audioStartMs":5000,"audioEndMs":10000}
        ]
        """;

    var ranges =
        NarrationTextClockMapper.map(
            List.of(new TextRange(0, 40), new TextRange(40, 70), new TextRange(70, 100)),
            spans,
            10_000L);

    assertThat(ranges)
        .extracting(range -> List.of(range.audioStartMs(), range.audioEndMs()))
        .containsExactly(List.of(0L, 4_000L), List.of(4_000L, 7_000L), List.of(7_000L, 10_000L));
  }

  @Test
  void rejectsNonIncreasingSemanticTransitions() {
    String spans = """
        [{"textStart":0,"textEnd":100,"audioStartMs":0,"audioEndMs":10000}]
        """;

    var ranges =
        NarrationTextClockMapper.map(
            List.of(new TextRange(0, 30), new TextRange(0, 50)), spans, 10_000L);

    assertThat(ranges).isEmpty();
  }

  @Test
  void rejectsAlignedClockWhenAnyVisualBeatExceedsTenSeconds() {
    String spans = """
        [{"textStart":0,"textEnd":100,"audioStartMs":0,"audioEndMs":25000}]
        """;

    var ranges =
        NarrationTextClockMapper.map(
            List.of(new TextRange(0, 50), new TextRange(50, 100)), spans, 25_000L);

    assertThat(ranges).isEmpty();
  }
}
