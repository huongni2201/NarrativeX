package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class NativeDialogueDurationEstimatorTest {
  @Test
  void estimatesByLanguageAndUnicodeCodePointsWithOnePauseBetweenLines() {
    assertThat(NativeDialogueDurationEstimator.estimateMs(List.of("a".repeat(67)), "vi-VN"))
        .isEqualTo(5_584L);
    assertThat(NativeDialogueDurationEstimator.estimateMs(List.of("😀".repeat(12)), "vi"))
        .isEqualTo(1_000L);
    assertThat(NativeDialogueDurationEstimator.estimateMs(List.of("a".repeat(15)), "en_US"))
        .isEqualTo(1_000L);
    assertThat(NativeDialogueDurationEstimator.estimateMs(List.of("a".repeat(10)), "fr"))
        .isEqualTo(1_000L);
    assertThat(NativeDialogueDurationEstimator.estimateMs(List.of("abc", "def"), "vi"))
        .isEqualTo(800L);
  }

  @Test
  void emptyDialogueHasNoEstimatedSpeechOrPause() {
    assertThat(NativeDialogueDurationEstimator.estimateMs(List.of(), "vi")).isZero();
    assertThat(NativeDialogueDurationEstimator.estimateMs(Arrays.asList("", "  ", null), "vi"))
        .isZero();
  }

  @Test
  void roundsSpeechUpToAWholeVideoFrame() {
    assertThat(NativeDialogueDurationEstimator.roundUpToFrame(5_584L, 24)).isEqualTo(5_625L);
    assertThat(NativeDialogueDurationEstimator.roundUpToFrame(0L, 24)).isZero();
    assertThatThrownBy(() -> NativeDialogueDurationEstimator.roundUpToFrame(100L, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
