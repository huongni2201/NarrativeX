package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionAttempt;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterAnalysisExecutionAttemptRow {
  private UUID attemptId;
  private UUID generationJobId;
  private int attemptNumber;
  private UUID claimRequestId;
  private UUID deviceId;
  private UUID credentialRef;
  private int credentialGeneration;
  private String inputFingerprint;
  private String checkpoint;
  private String leaseTokenHash;
  private Instant leaseExpiresAt;
  private long fencingToken;
  private long lastObservationSequence;
  private UUID submissionIntentId;
  private String conversationId;
  private String outputHash;
  private String completionPayloadHash;
  private String terminalReason;
  private boolean slotHeld;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;

  public static ChapterAnalysisExecutionAttemptRow from(ChapterAnalysisExecutionAttempt value) {
    ChapterAnalysisExecutionAttemptRow row = new ChapterAnalysisExecutionAttemptRow();
    row.setAttemptId(value.attemptId());
    row.setGenerationJobId(value.generationJobId());
    row.setAttemptNumber(value.attemptNumber());
    row.setClaimRequestId(value.claimRequestId());
    row.setDeviceId(value.deviceId());
    row.setCredentialRef(value.credentialRef());
    row.setCredentialGeneration(value.credentialGeneration());
    row.setInputFingerprint(value.inputFingerprint());
    row.setCheckpoint(value.checkpoint().name());
    row.setLeaseTokenHash(value.leaseTokenHash());
    row.setLeaseExpiresAt(value.leaseExpiresAt());
    row.setFencingToken(value.fencingToken());
    row.setLastObservationSequence(value.lastObservationSequence());
    row.setSubmissionIntentId(value.submissionIntentId());
    row.setConversationId(value.conversationId());
    row.setOutputHash(value.outputHash());
    row.setCompletionPayloadHash(value.completionPayloadHash());
    row.setTerminalReason(value.terminalReason());
    row.setSlotHeld(value.slotHeld());
    row.setRowVersion(value.rowVersion());
    row.setCreatedAt(value.createdAt());
    row.setUpdatedAt(value.updatedAt());
    return row;
  }
}
