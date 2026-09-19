package com.narrativex.backend.feature.generation.application.model.analysis;

public record VisualDirection(
    String shotSize,
    String cameraAngle,
    Integer lensMm,
    String focusTarget,
    String actionPhase,
    String subjectPlacement,
    String background,
    String motivatedLight,
    String palette,
    String cameraMovement,
    String movementIntensity,
    String cropSafeArea) {}
