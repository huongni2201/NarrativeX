package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess.ResolvedSpeakerVoice;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.AudioCueInfo;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerationPreflightEvaluatorTest {
  @Test
  void textConditionedVoiceNeedsDescriptionButDoesNotRequireCloningAudio() {
    UUID speaker = UUID.randomUUID();
    var cue = new AudioCueInfo(UUID.randomUUID(), UUID.randomUUID(), 0, "DIALOGUE", speaker);
    var voice =
        new ResolvedSpeakerVoice(
            UUID.randomUUID(),
            "Hero",
            UUID.randomUUID(),
            null,
            null,
            "vi",
            null,
            "Warm voice",
            null);
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.TEXT_TO_VIDEO,
                    List.of(cue),
                    Map.of(speaker, Optional.of(voice)))
                .ready())
        .isTrue();
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.MULTI_KEYFRAME,
                    List.of(cue),
                    Map.of(speaker, Optional.of(voice)))
                .ready())
        .isFalse();
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.IMAGE_TO_VIDEO,
                    List.of(cue),
                    Map.of(speaker, Optional.of(voice)))
                .ready())
        .isFalse();
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.IMAGE_TO_VIDEO,
                    List.of(GenerationStrategy.TEXT_TO_VIDEO, GenerationStrategy.IMAGE_TO_VIDEO),
                    List.of(cue),
                    Map.of(speaker, Optional.of(voice)))
                .ready())
        .isTrue();
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.TEXT_TO_VIDEO,
                    List.of(cue),
                    Map.of(speaker, Optional.empty()))
                .blockers())
        .anyMatch(s -> s.startsWith("MISSING_VOICE_PROFILE"));
    var missingSpeaker =
        new AudioCueInfo(UUID.randomUUID(), cue.storyBeatId(), 0, "DIALOGUE", null);
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.TEXT_TO_VIDEO, List.of(missingSpeaker), Map.of())
                .ready())
        .isFalse();
    var narrator = new AudioCueInfo(UUID.randomUUID(), cue.storyBeatId(), 0, "NARRATOR", null);
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.TEXT_TO_VIDEO, List.of(narrator), Map.of())
                .ready())
        .isTrue();
  }

  @Test
  void aspectRatioPreflightAccepts16x9AndRejectsOtherRatios() {
    assertThat(
            GenerationPreflightEvaluator.evaluate(
                    GenerationStrategy.TEXT_TO_VIDEO,
                    List.of(GenerationStrategy.TEXT_TO_VIDEO),
                    "16:9",
                    List.of(),
                    Map.of())
                .ready())
        .isTrue();

    var rejected9x16 =
        GenerationPreflightEvaluator.evaluate(
            GenerationStrategy.TEXT_TO_VIDEO,
            List.of(GenerationStrategy.TEXT_TO_VIDEO),
            "9:16",
            List.of(),
            Map.of());
    assertThat(rejected9x16.ready()).isFalse();
    assertThat(rejected9x16.blockers())
        .anyMatch(b -> b.contains("UNSUPPORTED_ASPECT_RATIO") && b.contains("9:16"));

    var rejected1x1 =
        GenerationPreflightEvaluator.evaluate(
            GenerationStrategy.TEXT_TO_VIDEO,
            List.of(GenerationStrategy.TEXT_TO_VIDEO),
            "1:1",
            List.of(),
            Map.of());
    assertThat(rejected1x1.ready()).isFalse();
    assertThat(rejected1x1.blockers())
        .anyMatch(b -> b.contains("UNSUPPORTED_ASPECT_RATIO") && b.contains("1:1"));
  }
}

