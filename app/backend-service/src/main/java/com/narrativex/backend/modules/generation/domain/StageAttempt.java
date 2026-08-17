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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(name = "stage_attempts", uniqueConstraints = @UniqueConstraint(
    name = "uk_stage_attempts_job_stage_number", columnNames = {"generation_job_id", "stage_name", "attempt_number"}))
public class StageAttempt extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generation_job_id", nullable = false,
        foreignKey = @ForeignKey(name = "fk_stage_attempts_job"))
    private GenerationJob generationJob;

    @Column(name = "stage_name", nullable = false, length = 64)
    private String stageName;

    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private JobStatus status = JobStatus.QUEUED;

    @Column(name = "worker_id", length = 128)
    private String workerId;

    @Column(name = "heartbeat_at")
    private Instant heartbeatAt;

    protected StageAttempt() {
    }

    public StageAttempt(GenerationJob generationJob, String stageName, int attemptNumber) {
        this.generationJob = generationJob;
        this.stageName = stageName;
        this.attemptNumber = attemptNumber;
    }

    public String getStageName() { return stageName; }
    public int getAttemptNumber() { return attemptNumber; }
    public JobStatus getStatus() { return status; }
}
