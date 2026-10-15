package com.narrativex.backend.feature.generation.application.model.analysis;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/** Redacted metadata for the one local agy session assigned to a Desktop device. */
public record AnalysisProviderCredential(
    UUID credentialRef,
    UUID deviceId,
    String connectionFingerprint,
    int credentialGeneration,
    String label,
    String observedConnectionState,
    String adapterVersion,
    List<String> modelCapabilities,
    String observedQuotaState,
    Instant quotaObservedAt,
    Instant nextEligibleAt,
    UUID runtimeEpoch,
    long observationSequence,
    long rowVersion) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");

  public AnalysisProviderCredential {
    if (credentialRef == null) throw new IllegalArgumentException("credentialRef is required");
    if (deviceId == null) throw new IllegalArgumentException("deviceId is required");
    if (connectionFingerprint == null || !SHA_256.matcher(connectionFingerprint).matches()) {
      throw new IllegalArgumentException("connectionFingerprint must be a SHA-256 hash");
    }
    if (credentialGeneration <= 0) {
      throw new IllegalArgumentException("credentialGeneration must be positive");
    }
    if (label == null || label.isBlank() || label.length() > 120) {
      throw new IllegalArgumentException("label must contain 1-120 characters");
    }
    if (!List.of("UNKNOWN", "CONNECTED", "AUTH_REQUIRED", "UNAVAILABLE")
        .contains(observedConnectionState)) {
      throw new IllegalArgumentException("observedConnectionState is invalid");
    }
    if (!List.of("UNKNOWN", "AVAILABLE", "RATE_LIMITED", "EXHAUSTED")
        .contains(observedQuotaState)) {
      throw new IllegalArgumentException("observedQuotaState is invalid");
    }
    modelCapabilities = List.copyOf(modelCapabilities == null ? List.of() : modelCapabilities);
    if (observationSequence < 0 || rowVersion < 0) {
      throw new IllegalArgumentException("credential sequence values must not be negative");
    }
  }

  /** Records one CLI session health or quota observation. */
  public AnalysisProviderCredential observed(
      String connectionState, String quotaState, Instant nextEligible, Instant observedAt) {
    return new AnalysisProviderCredential(
        credentialRef,
        deviceId,
        connectionFingerprint,
        credentialGeneration,
        label,
        connectionState,
        adapterVersion,
        modelCapabilities,
        quotaState,
        observedAt,
        nextEligible,
        runtimeEpoch,
        observationSequence + 1,
        rowVersion);
  }

  public AnalysisProviderCredential withIdentity(
      String newLabel, String newAdapterVersion, List<String> models) {
    return new AnalysisProviderCredential(
        credentialRef,
        deviceId,
        connectionFingerprint,
        credentialGeneration,
        newLabel,
        observedConnectionState,
        newAdapterVersion,
        models,
        observedQuotaState,
        quotaObservedAt,
        nextEligibleAt,
        runtimeEpoch,
        observationSequence,
        rowVersion);
  }

  /** True when this local CLI session can claim another job at {@code now}. */
  public boolean eligibleAt(Instant now) {
    if (!"UNKNOWN".equals(observedConnectionState)
        && !"CONNECTED".equals(observedConnectionState)) {
      return false;
    }
    boolean limited =
        "RATE_LIMITED".equals(observedQuotaState) || "EXHAUSTED".equals(observedQuotaState);
    return !limited || (nextEligibleAt != null && !nextEligibleAt.isAfter(now));
  }
}
