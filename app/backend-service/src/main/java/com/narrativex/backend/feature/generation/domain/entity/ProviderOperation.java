package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import java.time.Instant;
import java.util.Objects;

public final class ProviderOperation extends DomainEntity {
    private final Long stageAttemptId;
    private final String providerKey;
    private final String providerOperationId;
    private final JobStatus status;
    private final Instant reservedAt;

    private ProviderOperation(Long id, long rowVersion, Long stageAttemptId, String providerKey,
                              String providerOperationId, JobStatus status, Instant reservedAt) {
        super(id, rowVersion);
        if (stageAttemptId == null || stageAttemptId <= 0) throw new IllegalArgumentException("stageAttemptId must be positive");
        this.stageAttemptId = stageAttemptId;
        if (providerKey == null || providerKey.isBlank()) throw new IllegalArgumentException("providerKey must not be blank");
        this.providerKey = providerKey;
        this.providerOperationId = providerOperationId;
        this.status = Objects.requireNonNull(status, "status");
        this.reservedAt = Objects.requireNonNull(reservedAt, "reservedAt");
    }

    public static ProviderOperation create(Long stageAttemptId, String providerKey) {
        return new ProviderOperation(null, 0L, stageAttemptId, providerKey, null, JobStatus.QUEUED, Instant.now());
    }
    public static ProviderOperation rehydrate(Long id, long rowVersion, Long stageAttemptId, String providerKey,
                                              String providerOperationId, JobStatus status, Instant reservedAt) {
        return new ProviderOperation(id, rowVersion, stageAttemptId, providerKey, providerOperationId, status, reservedAt);
    }
    public Long getStageAttemptId() { return stageAttemptId; }
    public String getProviderKey() { return providerKey; }
    public String getProviderOperationId() { return providerOperationId; }
    public JobStatus getStatus() { return status; }
    public Instant getReservedAt() { return reservedAt; }
}
