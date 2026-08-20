package com.narrativex.backend.feature.account.application.port.in;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanFeatures(boolean storyAnalysis) {
  public static PlanFeatures none() {
    return new PlanFeatures(false);
  }
}
