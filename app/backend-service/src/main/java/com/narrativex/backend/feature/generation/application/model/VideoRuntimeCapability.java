package com.narrativex.backend.feature.generation.application.model;

import java.util.List;

public record VideoRuntimeCapability(
    boolean available,
    String status,
    String provider,
    String model,
    String profile,
    List<String> strategies,
    List<String> supportedAspectRatios,
    List<ResolutionProfile> resolutionProfiles,
    List<String> audioModes,
    String reason) {

  public VideoRuntimeCapability(
      boolean available,
      String provider,
      String model,
      String profile,
      List<String> strategies,
      List<String> supportedAspectRatios,
      List<ResolutionProfile> resolutionProfiles,
      List<String> audioModes) {
    this(
        available,
        available ? "READY" : "UNAVAILABLE",
        provider,
        model,
        profile,
        strategies,
        supportedAspectRatios,
        resolutionProfiles,
        audioModes,
        null);
  }

  public record ResolutionProfile(int width, int height, int fps) {}
}
