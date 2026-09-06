package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AnalysisProgressRow {
  private String phase;
  private int completedShards;
  private int totalShards;
  private int reusedShards;
  private int repairCount;
  private UUID continuityReportId;
  private String pipelineVersion;
}
