package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.service.NarrationTextClockMapper.TextRange;
import java.util.List;
import org.junit.jupiter.api.Test;

class NarrationTextClockMapperTest {
  @Test
  void mapsSemanticBeatStartsFromMeasuredNarrationWords() {
    String words =
        """
        [
          {"index":0,"textStart":0,"textEnd":39,"audioStartMs":0,"audioEndMs":3500,"confidence":0.99},
          {"index":1,"textStart":40,"textEnd":69,"audioStartMs":4000,"audioEndMs":6500,"confidence":0.98},
          {"index":2,"textStart":70,"textEnd":100,"audioStartMs":7000,"audioEndMs":10000,"confidence":0.97}
        ]
        """;

    var ranges =
        NarrationTextClockMapper.map(
            List.of(new TextRange(0, 40), new TextRange(40, 70), new TextRange(70, 100)),
            words,
            10_000L);

    assertThat(ranges)
        .extracting(range -> List.of(range.audioStartMs(), range.audioEndMs()))
        .containsExactly(List.of(0L, 4_000L), List.of(4_000L, 7_000L), List.of(7_000L, 10_000L));
  }

  @Test
  void rejectsNonIncreasingSemanticTransitions() {
    String words =
        """
        [{"index":0,"textStart":0,"textEnd":100,"audioStartMs":0,"audioEndMs":10000,"confidence":0.99}]
        """;

    var ranges =
        NarrationTextClockMapper.map(
            List.of(new TextRange(0, 30), new TextRange(0, 50)), words, 10_000L);

    assertThat(ranges).isEmpty();
  }

  @Test
  void rejectsAlignedClockWhenAnyVisualBeatExceedsTenSeconds() {
    String words =
        """
        [
          {"index":0,"textStart":0,"textEnd":49,"audioStartMs":0,"audioEndMs":1000,"confidence":0.99},
          {"index":1,"textStart":50,"textEnd":100,"audioStartMs":12000,"audioEndMs":25000,"confidence":0.99}
        ]
        """;

    var ranges =
        NarrationTextClockMapper.map(
            List.of(new TextRange(0, 50), new TextRange(50, 100)), words, 25_000L);

    assertThat(ranges).isEmpty();
  }
}
