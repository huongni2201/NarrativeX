package com.narrativex.backend.feature.generation.application.model;

import java.util.List;

public record VideoRuntimeCapability(
    boolean available,
    String provider,
    String model,
    String profile,
    List<String> strategies,
    List<String> supportedAspectRatios,
    List<ResolutionProfile> resolutionProfiles,
    List<String> audioModes) {

  public record ResolutionProfile(int width, int height, int fps) {}
}
