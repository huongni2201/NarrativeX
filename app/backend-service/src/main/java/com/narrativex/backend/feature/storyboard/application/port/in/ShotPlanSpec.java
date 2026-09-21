package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import java.util.List;

/** Typed specification for an individual Shot within a planned ShotSequence. */
public record ShotPlanSpec(
    int orderIndex,
    String narrativePurpose,
    RetentionRole retentionRole,
    List<String> characterAiNames,
    String locationAiName,
    String startState,
    String action,
    String endState,
    String composition,
    String camera,
    String subjectMotion,
    String cameraMotion,
    String environmentMotion,
    long targetDurationMs,
    GenerationStrategy recommendedStrategy,
    boolean intentionalStaticHold) {

  public ShotPlanSpec(
      int orderIndex,
      String narrativePurpose,
      RetentionRole retentionRole,
      List<String> characterAiNames,
      String locationAiName,
      String startState,
      String action,
      String endState,
      String composition,
      String camera,
      String subjectMotion,
      String cameraMotion,
      String environmentMotion,
      long targetDurationMs,
      GenerationStrategy recommendedStrategy) {
    this(
        orderIndex,
        narrativePurpose,
        retentionRole,
        characterAiNames,
        locationAiName,
        startState,
        action,
        endState,
        composition,
        camera,
        subjectMotion,
        cameraMotion,
        environmentMotion,
        targetDurationMs,
        recommendedStrategy,
        false);
  }
}
