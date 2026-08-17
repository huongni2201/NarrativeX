package com.narrativex.backend.modules.generation.domain;

import com.narrativex.backend.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "provider_operations")
public class ProviderOperation extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stage_attempt_id", nullable = false,
        foreignKey = @ForeignKey(name = "fk_provider_operations_stage"))
    private StageAttempt stageAttempt;

    @Column(name = "provider_key", nullable = false, length = 64)
    private String providerKey;

    @Column(name = "provider_operation_id", length = 256)
    private String providerOperationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private JobStatus status = JobStatus.QUEUED;

    @Column(name = "reserved_at", nullable = false)
    private Instant reservedAt = Instant.now();

    protected ProviderOperation() {
    }

    public ProviderOperation(StageAttempt stageAttempt, String providerKey) {
        this.stageAttempt = stageAttempt;
        this.providerKey = providerKey;
    }

    public String getProviderKey() { return providerKey; }
    public JobStatus getStatus() { return status; }
    public String getProviderOperationId() { return providerOperationId; }
}
