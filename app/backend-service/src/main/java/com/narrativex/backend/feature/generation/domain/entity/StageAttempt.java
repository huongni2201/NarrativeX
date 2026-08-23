package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class StageAttempt extends DomainEntity {
  private final UUID generationJobId;
  private final String stageName;
  private final int attemptNumber;
  private final JobStatus status;
  private final String workerId;
  private final Instant heartbeatAt;

  private StageAttempt(
      UUID id,
      long rowVersion,
      UUID generationJobId,
      String stageName,
      int attemptNumber,
      JobStatus status,
      String workerId,
      Instant heartbeatAt) {
    super(id, rowVersion);
    this.generationJobId = Objects.requireNonNull(generationJobId, "generationJobId");
    if (stageName == null || stageName.isBlank())
      throw new IllegalArgumentException("stageName must not be blank");
    this.stageName = stageName;
    if (attemptNumber <= 0) throw new IllegalArgumentException("attemptNumber must be positive");
    this.attemptNumber = attemptNumber;
    this.status = Objects.requireNonNull(status, "status");
    this.workerId = workerId;
    this.heartbeatAt = heartbeatAt;
  }

  public static StageAttempt create(UUID generationJobId, String stageName, int attemptNumber) {
    return new StageAttempt(
        null, 0L, generationJobId, stageName, attemptNumber, JobStatus.QUEUED, null, null);
  }

  public static StageAttempt rehydrate(
      UUID id,
      long rowVersion,
      UUID generationJobId,
      String stageName,
      int attemptNumber,
      JobStatus status,
      String workerId,
      Instant heartbeatAt) {
    return new StageAttempt(
        id, rowVersion, generationJobId, stageName, attemptNumber, status, workerId, heartbeatAt);
  }

  public UUID getGenerationJobId() { return generationJobId; }
  public String getStageName() { return stageName; }
  public int getAttemptNumber() { return attemptNumber; }
  public JobStatus getStatus() { return status; }
  public String getWorkerId() { return workerId; }
  public Instant getHeartbeatAt() { return heartbeatAt; }
}
