package com.narrativex.backend.feature.generation.application.model.analysis;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/** Redacted provider connection metadata; never contains tokens or local profile paths. */
public record AnalysisProviderCredential(
    UUID credentialRef,
    UUID deviceId,
    String connectionFingerprint,
    int credentialGeneration,
    String label,
    String selfReportedTier,
    boolean desiredEnabled,
    int desiredMaxConcurrent,
    Instant drainRequestedAt,
    Instant retiredAt,
    String observedConnectionState,
    String cliVersion,
    List<String> modelCapabilities,
    String observedQuotaState,
    Instant quotaObservedAt,
    Instant nextEligibleAt,
    UUID runtimeEpoch,
    long observationSequence,
    long lastAssignedOrdinal,
    long rowVersion) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");

  public AnalysisProviderCredential {
    if (credentialRef == null) throw new IllegalArgumentException("credentialRef is required");
    if (deviceId == null) throw new IllegalArgumentException("deviceId is required");
    if (connectionFingerprint != null && !SHA_256.matcher(connectionFingerprint).matches()) {
      throw new IllegalArgumentException("connectionFingerprint must be a SHA-256 hash");
    }
    if (credentialGeneration <= 0) {
      throw new IllegalArgumentException("credentialGeneration must be positive");
    }
    if (label == null || label.isBlank() || label.length() > 120) {
      throw new IllegalArgumentException("label must contain 1-120 characters");
    }
    if (selfReportedTier != null
        && !List.of("PRO", "ULTRA", "UNKNOWN").contains(selfReportedTier)) {
      throw new IllegalArgumentException("selfReportedTier is invalid");
    }
    if (desiredMaxConcurrent < 1 || desiredMaxConcurrent > 16) {
      throw new IllegalArgumentException("desiredMaxConcurrent must be between 1 and 16");
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
    if (observationSequence < 0 || lastAssignedOrdinal < 0 || rowVersion < 0) {
      throw new IllegalArgumentException("credential sequence values must not be negative");
    }
  }

  /** New connection/quota observation; the sequence advances so stale reports are distinguishable. */
  public AnalysisProviderCredential observed(
      String connectionState, String quotaState, Instant nextEligible, Instant observedAt) {
    return new AnalysisProviderCredential(
        credentialRef, deviceId, connectionFingerprint, credentialGeneration, label,
        selfReportedTier, desiredEnabled, desiredMaxConcurrent, drainRequestedAt, retiredAt,
        connectionState, cliVersion, modelCapabilities, quotaState, observedAt, nextEligible,
        runtimeEpoch, observationSequence + 1, lastAssignedOrdinal, rowVersion);
  }

  /** Records a round-robin assignment and the adapter revision that claimed work. */
  public AnalysisProviderCredential assigned(String clientVersion) {
    return new AnalysisProviderCredential(
        credentialRef, deviceId, connectionFingerprint, credentialGeneration, label,
        selfReportedTier, desiredEnabled, desiredMaxConcurrent, drainRequestedAt, retiredAt,
        observedConnectionState, clientVersion == null ? cliVersion : clientVersion,
        modelCapabilities, observedQuotaState, quotaObservedAt, nextEligibleAt, runtimeEpoch,
        observationSequence, lastAssignedOrdinal + 1, rowVersion);
  }

  public AnalysisProviderCredential withIdentity(
      String newLabel, String clientVersion, List<String> models) {
    return new AnalysisProviderCredential(
        credentialRef, deviceId, connectionFingerprint, credentialGeneration, newLabel,
        selfReportedTier, desiredEnabled, desiredMaxConcurrent, drainRequestedAt, retiredAt,
        observedConnectionState, clientVersion, models, observedQuotaState, quotaObservedAt,
        nextEligibleAt, runtimeEpoch, observationSequence, lastAssignedOrdinal, rowVersion);
  }

  public AnalysisProviderCredential withDesired(boolean enabled, int maxConcurrent) {
    return new AnalysisProviderCredential(
        credentialRef, deviceId, connectionFingerprint, credentialGeneration, label,
        selfReportedTier, enabled, maxConcurrent, drainRequestedAt, retiredAt,
        observedConnectionState, cliVersion, modelCapabilities, observedQuotaState,
        quotaObservedAt, nextEligibleAt, runtimeEpoch, observationSequence, lastAssignedOrdinal,
        rowVersion);
  }

  public AnalysisProviderCredential retire(Instant at) {
    return new AnalysisProviderCredential(
        credentialRef, deviceId, connectionFingerprint, credentialGeneration, label,
        selfReportedTier, false, desiredMaxConcurrent, drainRequestedAt, at,
        observedConnectionState, cliVersion, modelCapabilities, observedQuotaState,
        quotaObservedAt, nextEligibleAt, runtimeEpoch, observationSequence, lastAssignedOrdinal,
        rowVersion);
  }

  /** True when the backend may assign new work to this account at {@code now}. */
  public boolean eligibleAt(Instant now) {
    if (!desiredEnabled || retiredAt != null || drainRequestedAt != null) return false;
    if (!"UNKNOWN".equals(observedConnectionState) && !"CONNECTED".equals(observedConnectionState)) {
      return false;
    }
    boolean limited =
        "RATE_LIMITED".equals(observedQuotaState) || "EXHAUSTED".equals(observedQuotaState);
    return !limited || (nextEligibleAt != null && !nextEligibleAt.isAfter(now));
  }
}
