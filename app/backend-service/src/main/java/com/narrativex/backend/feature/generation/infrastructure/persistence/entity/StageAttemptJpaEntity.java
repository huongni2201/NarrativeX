package com.narrativex.backend.feature.generation.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "stage_attempts",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_stage_attempts_job_stage_number",
            columnNames = {"generation_job_id", "stage_name", "attempt_number"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StageAttemptJpaEntity extends JpaAuditedEntity {
  @Column(name = "generation_job_id", nullable = false)
  private Long generationJobId;

  @Column(name = "stage_name", nullable = false, length = 64)
  private String stageName;

  @Column(name = "attempt_number", nullable = false)
  private int attemptNumber;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 32)
  private JobStatus status;

  @Column(name = "worker_id", length = 128)
  private String workerId;

  @Column(name = "heartbeat_at")
  private Instant heartbeatAt;
}

