package com.narrativex.backend.feature.generation.application.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Frozen semantic inputs. Expiring byte capabilities are minted only during dispatch. */
public record TakeInputSnapshot(
    int schemaVersion,
    UUID shotId,
    int attemptNumber,
    String requestFingerprint,
    String inputFingerprint,
    String provider,
    String model,
    String modelRevision,
    String workflowRevision,
    String qualityProfile,
    String audioMode,
    long seed,
    Instant deadline,
    Map<String, Object> context,
    Map<String, Object> inputs,
    List<Reference> references) {
  public record Reference(
      UUID assetId, String role, String sha256, long sizeBytes, String mediaType, double weight) {}
}
