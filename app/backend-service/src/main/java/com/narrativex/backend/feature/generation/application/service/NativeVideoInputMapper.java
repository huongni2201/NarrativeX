package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Translates NarrativeX Shot fields into the closed Native AV input shape. */
@Component
public class NativeVideoInputMapper {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  public NativeVideoInputs map(
      ShotView shot, List<NativeDialogueLine> dialogue, NativeVoiceDescription voiceReference) {
    Objects.requireNonNull(shot, "shot must not be null");
    var camera = readObject(shot.cameraJson(), "cameraJson");
    var composition = readObject(shot.compositionJson(), "compositionJson");
    var cameraMotion = readObject(shot.cameraMotionJson(), "cameraMotionJson");
    var action = readObject(shot.actionJson(), "actionJson");
    var subjectMotion = readObject(shot.subjectMotionJson(), "subjectMotionJson");

    var cameraIntent =
        intent(
            new NativeCameraIntent(
                first(camera, "framing", composition, "framing", "composition"),
                first(cameraMotion, "movement", cameraMotion, "cameraMotion"),
                first(camera, "angle", composition, "angle"),
                first(cameraMotion, "speed", camera, "speed")));
    var motionIntent =
        intent(
            new NativeMotionIntent(
                first(subjectMotion, "subjectMotion", "action", action, "subjectMotion", "action"),
                first(subjectMotion, "speed", action, "speed"),
                first(subjectMotion, "dynamics", action, "dynamics")));
    return new NativeVideoInputs(cameraIntent, motionIntent, dialogue, voiceReference);
  }

  private static NativeCameraIntent intent(NativeCameraIntent value) {
    return value.framing() == null
            && value.movement() == null
            && value.angle() == null
            && value.speed() == null
        ? null
        : value;
  }

  private static NativeMotionIntent intent(NativeMotionIntent value) {
    return value.subjectMotion() == null && value.speed() == null && value.dynamics() == null
        ? null
        : value;
  }

  private static String first(
      Map<String, Object> first,
      String firstKey,
      Map<String, Object> second,
      String... secondKeys) {
    String value = string(first, firstKey);
    if (value != null) return value;
    for (String key : secondKeys) {
      value = string(second, key);
      if (value != null) return value;
    }
    return null;
  }

  private static String first(
      Map<String, Object> first,
      String firstKey,
      String secondKey,
      Map<String, Object> second,
      String... secondKeys) {
    String value = string(first, firstKey);
    if (value == null) value = string(first, secondKey);
    if (value != null) return value;
    for (String key : secondKeys) {
      value = string(second, key);
      if (value != null) return value;
    }
    return null;
  }

  private static String string(Map<String, Object> source, String field) {
    Object value = source.get(field);
    if (value == null) return null;
    if (!(value instanceof String text)) {
      throw new DomainValidationException("INVALID_SHOT_INPUT: " + field + " must be a string");
    }
    String trimmed = text.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private static Map<String, Object> readObject(String json, String field) {
    if (json == null || json.isBlank()) return Map.of();
    try {
      Map<String, Object> value = JSON.readValue(json, new TypeReference<>() {});
      return value == null ? Map.of() : value;
    } catch (Exception exception) {
      throw new DomainValidationException(
          "INVALID_SHOT_INPUT: " + field + " must be a JSON object");
    }
  }

  public record NativeVideoInputs(
      NativeCameraIntent cameraIntent,
      NativeMotionIntent motionIntent,
      List<NativeDialogueLine> dialogue,
      NativeVoiceDescription voiceReference) {
    public NativeVideoInputs {
      dialogue = dialogue == null ? List.of() : List.copyOf(dialogue);
    }
  }

  public record NativeCameraIntent(String framing, String movement, String angle, String speed) {}

  public record NativeMotionIntent(String subjectMotion, String speed, String dynamics) {}

  public record NativeDialogueLine(String speaker, String text, String voiceDescription) {}

  public record NativeVoiceDescription(
      String language, String accent, String voiceDescription, String deliveryBaseline) {}
}
