package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import com.narrativex.backend.feature.storyboard.application.port.in.ShotPlanSpec;
import com.narrativex.backend.feature.storyboard.domain.entity.Shot;
import com.narrativex.backend.feature.storyboard.domain.entity.ShotSequence;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Translates dramatic VisualBeats into concrete ShotSequences and Shots,
 * validates temporal progression, and assigns initial generation strategies.
 */
@Service
public class ShotDirector {

  /**
   * Enforces temporal progression: every Shot must define kinetic or compositional change
   * between startState and endState unless explicitly flagged as an intentional narrative hold.
   */
  public void validateTemporalProgression(ShotPlanSpec spec) {
    Objects.requireNonNull(spec, "spec must not be null");
    if (spec.startState() != null && spec.endState() != null) {
      String start = spec.startState().trim().toLowerCase();
      String end = spec.endState().trim().toLowerCase();
      if (!start.isEmpty() && start.equals(end) && !spec.intentionalStaticHold()) {
        throw new IllegalArgumentException(
            "Temporal progression violation: startState and endState are identical without intentionalStaticHold flag: "
                + spec.startState());
      }
    }
  }

  /**
   * Recommends a generation strategy according to ADR-0029 decision matrix.
   */
  public GenerationStrategy recommendGenerationStrategy(ShotPlanSpec spec) {
    Objects.requireNonNull(spec, "spec must not be null");
    if (spec.recommendedStrategy() != null) {
      return spec.recommendedStrategy();
    }
    if (spec.characterAiNames() != null && !spec.characterAiNames().isEmpty()) {
      return GenerationStrategy.IMAGE_TO_VIDEO;
    }
    return GenerationStrategy.TEXT_TO_VIDEO;
  }

  /**
   * Builds an individual Shot entity from a specification, validating temporal progression.
   */
  public Shot buildShot(UUID sequenceId, ShotPlanSpec spec) {
    Objects.requireNonNull(sequenceId, "sequenceId must not be null");
    Objects.requireNonNull(spec, "spec must not be null");

    validateTemporalProgression(spec);
    GenerationStrategy strategy = recommendGenerationStrategy(spec);

    String subjectsJson =
        spec.characterAiNames() != null && !spec.characterAiNames().isEmpty()
            ? "["
                + String.join(
                    ",",
                    spec.characterAiNames().stream()
                        .map(name -> "{\"aiName\":\"" + escapeJson(name) + "\"}")
                        .toList())
                + "]"
            : "[]";

    String startJson =
        spec.startState() != null ? "{\"state\":\"" + escapeJson(spec.startState()) + "\"}" : "{}";
    String actionJson =
        spec.action() != null ? "{\"action\":\"" + escapeJson(spec.action()) + "\"}" : "{}";
    String endJson =
        spec.endState() != null ? "{\"state\":\"" + escapeJson(spec.endState()) + "\"}" : "{}";
    String compJson =
        spec.composition() != null
            ? "{\"composition\":\"" + escapeJson(spec.composition()) + "\"}"
            : "{}";
    String cameraJson =
        spec.camera() != null ? "{\"camera\":\"" + escapeJson(spec.camera()) + "\"}" : "{}";
    String subjMotionJson =
        spec.subjectMotion() != null
            ? "{\"subjectMotion\":\"" + escapeJson(spec.subjectMotion()) + "\"}"
            : "{}";
    String camMotionJson =
        spec.cameraMotion() != null
            ? "{\"cameraMotion\":\"" + escapeJson(spec.cameraMotion()) + "\"}"
            : "{}";
    String envMotionJson =
        spec.environmentMotion() != null
            ? "{\"environmentMotion\":\"" + escapeJson(spec.environmentMotion()) + "\"}"
            : "{}";

    return new Shot(
        sequenceId,
        spec.orderIndex(),
        spec.narrativePurpose(),
        spec.retentionRole(),
        subjectsJson,
        spec.locationAiName(),
        startJson,
        actionJson,
        endJson,
        compJson,
        cameraJson,
        subjMotionJson,
        camMotionJson,
        envMotionJson,
        spec.targetDurationMs(),
        strategy,
        "720p_24fps_standard",
        null,
        null,
        ShotStatus.PLANNED);
  }

  /**
   * Translates a dramatic VisualBeat into a concrete ShotSequence containing validated Shots.
   */
  public ShotSequence planShotSequence(
      UUID visualBeatId, int orderIndex, List<ShotPlanSpec> shotSpecs) {
    Objects.requireNonNull(visualBeatId, "visualBeatId must not be null");

    UUID sequenceId = UUID.randomUUID();
    List<Shot> shots = new ArrayList<>();
    if (shotSpecs != null) {
      for (ShotPlanSpec spec : shotSpecs) {
        shots.add(buildShot(sequenceId, spec));
      }
    }

    return new ShotSequence(sequenceId, 0L, visualBeatId, orderIndex, shots);
  }

  private String escapeJson(String input) {
    if (input == null) {
      return "";
    }
    return input.replace("\"", "\\\"");
  }
}
