package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProviderOperationRow {
  private UUID id;
  private long rowVersion;
  private UUID stageAttemptId;
  private String providerKey;
  private String providerOperationId;
  private ProviderOperationStatus status;
  private String requestFingerprint;
  private String normalizedResultJson;
  private String resultFingerprint;
  private Instant reservedAt;
  private Instant completedAt;
  private Instant nextReconcileAt;
  private int reconcileAttempts;
  private String lastReconcileError;
}
