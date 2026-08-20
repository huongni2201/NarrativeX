package com.narrativex.backend.feature.account.application.port.in;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanFeatures(Boolean storyAnalysis) {
  public PlanFeatures {
    storyAnalysis = Boolean.TRUE.equals(storyAnalysis);
  }

  public boolean storyAnalysisEnabled() {
    return Boolean.TRUE.equals(storyAnalysis);
  }

  public static PlanFeatures none() {
    return new PlanFeatures(false);
  }
}
