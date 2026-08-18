package com.narrativex.backend.feature.generation.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "provider_operations")
public class ProviderOperationJpaEntity extends JpaAuditedEntity {
  @Column(name = "stage_attempt_id", nullable = false)
  private Long stageAttemptId;

  @Column(name = "provider_key", nullable = false, length = 64)
  private String providerKey;

  @Column(name = "provider_operation_id", length = 256)
  private String providerOperationId;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 32)
  private JobStatus status;

  @Column(name = "reserved_at", nullable = false)
  private Instant reservedAt;

  protected ProviderOperationJpaEntity() {}
}
