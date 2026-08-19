package com.narrativex.backend.feature.generation.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "provider_operations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProviderOperationJpaEntity extends JpaAuditedEntity {
  @Column(name = "stage_attempt_id", nullable = false)
  private Long stageAttemptId;

  @Column(name = "provider_key", nullable = false, length = 64)
  private String providerKey;

  @Column(name = "provider_operation_id", length = 256)
  private String providerOperationId;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 32)
  private ProviderOperationStatus status;

  @Column(name = "request_fingerprint", length = 128)
  private String requestFingerprint;

  @Column(name = "reserved_at", nullable = false)
  private Instant reservedAt;
}
