package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OperationPlanRow {
  private UUID id;
  private long rowVersion;
  private UUID projectId;
  private UUID generationJobId;
  private String operationType;
  private UUID scopeId;
  private String inputFingerprint;

  public OperationPlanRow(UUID id, long rowVersion, UUID projectId, UUID jobId, String type) {
    this(id, rowVersion, projectId, jobId, type, null, null);
  }
}
