package com.narrativex.backend.feature.account.application.port.in;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanFeatures(Boolean storyAnalysis, Boolean narration) {
  public PlanFeatures {
    storyAnalysis = Boolean.TRUE.equals(storyAnalysis);
    narration = Boolean.TRUE.equals(narration);
  }

  /** Backward-compatible constructor for existing tests and callers. */
  public PlanFeatures(Boolean storyAnalysis) {
    this(storyAnalysis, false);
  }

  public boolean storyAnalysisEnabled() {
    return Boolean.TRUE.equals(storyAnalysis);
  }

  public boolean narrationEnabled() {
    return Boolean.TRUE.equals(narration);
  }

  public static PlanFeatures none() {
    return new PlanFeatures(false, false);
  }
}
