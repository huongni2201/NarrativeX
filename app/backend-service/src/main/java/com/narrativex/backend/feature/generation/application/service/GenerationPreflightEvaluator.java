package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess.ResolvedSpeakerVoice;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.AudioCueInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Shared, I/O-free rules for production reads and shot admission. */
public final class GenerationPreflightEvaluator {
  private GenerationPreflightEvaluator() {}

  public record Preflight(boolean ready, List<String> blockers, List<String> warnings) {}

  public static Preflight evaluate(
      GenerationStrategy strategy,
      List<AudioCueInfo> cues,
      Map<UUID, Optional<ResolvedSpeakerVoice>> voices) {
    var blockers = new ArrayList<String>();
    if (strategy != null
        && !Set.of(
                GenerationStrategy.TEXT_TO_VIDEO,
                GenerationStrategy.IMAGE_TO_VIDEO,
                GenerationStrategy.FIRST_LAST_FRAME)
            .contains(strategy)) {
      blockers.add(
          "UNSUPPORTED_STRATEGY: Strategy "
              + strategy
              + " is not supported by current video runtime.");
    }
    if (cues.stream().anyMatch(cue -> !voiceReady(cue, voices))) {
      blockers.add(
          "MISSING_VOICE_PROFILE: Speaker requires an active voice profile with a voice description.");
    }
    return new Preflight(blockers.isEmpty(), List.copyOf(blockers), List.of());
  }

  public static boolean voiceReady(
      AudioCueInfo cue, Map<UUID, Optional<ResolvedSpeakerVoice>> voices) {
    if (cue.speakerProjectCharacterId() == null) {
      return !"DIALOGUE".equalsIgnoreCase(cue.cueType())
          && !"VOICEOVER".equalsIgnoreCase(cue.cueType());
    }
    return voices
        .getOrDefault(cue.speakerProjectCharacterId(), Optional.empty())
        .filter(
            v ->
                v.voiceProfileId() != null
                    && v.voiceDescription() != null
                    && !v.voiceDescription().isBlank())
        .isPresent();
  }

  public static boolean requiresVoiceProfile(String cueType, UUID speakerProjectCharacterId) {
    return speakerProjectCharacterId != null
        || "DIALOGUE".equalsIgnoreCase(cueType)
        || "VOICEOVER".equalsIgnoreCase(cueType);
  }
}
