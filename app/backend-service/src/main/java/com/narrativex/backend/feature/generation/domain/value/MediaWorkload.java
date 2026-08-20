package com.narrativex.backend.feature.generation.domain.value;

/** Immutable workload snapshot used by later pricing, reservation, and reconciliation stages. */
public record MediaWorkload(
    long narrationCharacters,
    int imageGenerateCount,
    int imageEditCount,
    int basicMotionSeconds,
    int plannedI2vSeconds) {
  public MediaWorkload {
    if (narrationCharacters < 0) {
      throw new IllegalArgumentException("narrationCharacters must not be negative");
    }
    if (imageGenerateCount < 0) {
      throw new IllegalArgumentException("imageGenerateCount must not be negative");
    }
    if (imageEditCount < 0) {
      throw new IllegalArgumentException("imageEditCount must not be negative");
    }
    if (basicMotionSeconds < 0) {
      throw new IllegalArgumentException("basicMotionSeconds must not be negative");
    }
    if (plannedI2vSeconds < 0) {
      throw new IllegalArgumentException("plannedI2vSeconds must not be negative");
    }
  }
}
