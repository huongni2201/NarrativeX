package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Data;

@Data
public class CurrentContinuityRow {
  private UUID planId;
  private Integer planRevision;
  private String sourceHash;
  private String reportStatus;
  private Integer reportRevision;
  private String issuesJson;
}
