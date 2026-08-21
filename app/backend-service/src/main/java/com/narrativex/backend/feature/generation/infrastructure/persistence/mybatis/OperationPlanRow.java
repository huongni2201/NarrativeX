package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OperationPlanRow {
  private Long id;
  private long rowVersion;
  private Long projectId;
  private Long generationJobId;
  private String operationType;
  private BigDecimal estimateMin;
  private BigDecimal estimateMax;
  private BigDecimal maxAuthorizedCost;
  private EstimateConfidence confidence;
}
