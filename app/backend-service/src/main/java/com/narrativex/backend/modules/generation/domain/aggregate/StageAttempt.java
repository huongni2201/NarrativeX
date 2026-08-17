package com.narrativex.backend.modules.generation.domain.aggregate;

import com.narrativex.backend.shared.domain.DomainEntity;
import java.time.Instant;
import java.util.Objects;

public final class StageAttempt extends DomainEntity {

    private final Long generationJobId;
    private final String stageName;
    private final int attemptNumber;
    private final JobStatus status;
    private final String workerId;
    private final Instant heartbeatAt;

    private StageAttempt(Long id, long rowVersion, Long generationJobId, String stageName, int attemptNumber,
                         JobStatus status, String workerId, Instant heartbeatAt) {
        super(id, rowVersion);
        this.generationJobId = Objects.requireNonNull(generationJobId, "generationJobId");
        this.stageName = Objects.requireNonNull(stageName, "stageName");
        this.attemptNumber = attemptNumber;
        this.status = Objects.requireNonNull(status, "status");
        this.workerId = workerId;
        this.heartbeatAt = heartbeatAt;
    }

    public static StageAttempt create(Long generationJobId, String stageName, int attemptNumber) {
        return new StageAttempt(null, 0L, generationJobId, stageName, attemptNumber,
            JobStatus.QUEUED, null, null);
    }

    public static StageAttempt rehydrate(Long id, long rowVersion, Long generationJobId, String stageName,
                                         int attemptNumber, JobStatus status, String workerId,
                                         Instant heartbeatAt) {
        return new StageAttempt(id, rowVersion, generationJobId, stageName, attemptNumber, status,
            workerId, heartbeatAt);
    }

    public Long getGenerationJobId() { return generationJobId; }
    public String getStageName() { return stageName; }
    public int getAttemptNumber() { return attemptNumber; }
    public JobStatus getStatus() { return status; }
    public String getWorkerId() { return workerId; }
    public Instant getHeartbeatAt() { return heartbeatAt; }
}
