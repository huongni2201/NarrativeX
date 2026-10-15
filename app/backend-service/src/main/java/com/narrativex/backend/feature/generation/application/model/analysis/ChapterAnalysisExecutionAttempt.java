package com.narrativex.backend.feature.generation.application.model.analysis;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisAttemptCheckpoint;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/** Durable local-execution assignment and no-retry checkpoint for one analysis attempt. */
public record ChapterAnalysisExecutionAttempt(
    UUID attemptId,
    UUID generationJobId,
    int attemptNumber,
    UUID claimRequestId,
    UUID deviceId,
    UUID credentialRef,
    int credentialGeneration,
    String inputFingerprint,
    ChapterAnalysisAttemptCheckpoint checkpoint,
    String leaseTokenHash,
    Instant leaseExpiresAt,
    long fencingToken,
    long lastObservationSequence,
    UUID submissionIntentId,
    String conversationId,
    String outputHash,
    String completionPayloadHash,
    String terminalReason,
    boolean slotHeld,
    long rowVersion,
    Instant createdAt,
    Instant updatedAt) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");

  public ChapterAnalysisExecutionAttempt observed(
      ChapterAnalysisAttemptCheckpoint state,
      String conversation,
      String output,
      String payload,
      String reason,
      boolean held) {
    return new ChapterAnalysisExecutionAttempt(
        attemptId,
        generationJobId,
        attemptNumber,
        claimRequestId,
        deviceId,
        credentialRef,
        credentialGeneration,
        inputFingerprint,
        state,
        leaseTokenHash,
        leaseExpiresAt,
        fencingToken,
        lastObservationSequence + 1,
        submissionIntentId,
        conversation,
        output,
        payload,
        reason,
        held,
        rowVersion,
        createdAt,
        Instant.now());
  }

  public ChapterAnalysisExecutionAttempt {
    Objects.requireNonNull(attemptId, "attemptId must not be null");
    Objects.requireNonNull(generationJobId, "generationJobId must not be null");
    Objects.requireNonNull(claimRequestId, "claimRequestId must not be null");
    Objects.requireNonNull(deviceId, "deviceId must not be null");
    Objects.requireNonNull(credentialRef, "credentialRef must not be null");
    Objects.requireNonNull(checkpoint, "checkpoint must not be null");
    Objects.requireNonNull(leaseExpiresAt, "leaseExpiresAt must not be null");
    requireHash(inputFingerprint, "inputFingerprint", false);
    requireHash(leaseTokenHash, "leaseTokenHash", false);
    requireHash(outputHash, "outputHash", true);
    requireHash(completionPayloadHash, "completionPayloadHash", true);
    if (attemptNumber <= 0 || credentialGeneration <= 0 || fencingToken <= 0) {
      throw new IllegalArgumentException("attempt sequence values must be positive");
    }
    if (lastObservationSequence < 0 || rowVersion < 0) {
      throw new IllegalArgumentException("observationSequence and rowVersion must not be negative");
    }
    if (createdAt == null) createdAt = Instant.now();
    if (updatedAt == null) updatedAt = createdAt;
  }

  private static void requireHash(String value, String field, boolean nullable) {
    if (value == null && nullable) return;
    if (value == null || !SHA_256.matcher(value).matches()) {
      throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hash");
    }
  }
}
