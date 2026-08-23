package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import java.math.BigDecimal;
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
  private BigDecimal estimateMin;
  private BigDecimal estimateMax;
  private BigDecimal maxAuthorizedCost;
  private EstimateConfidence confidence;
}
