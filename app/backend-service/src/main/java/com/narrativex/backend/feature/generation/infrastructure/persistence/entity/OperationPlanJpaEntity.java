package com.narrativex.backend.feature.generation.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "operation_plans")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationPlanJpaEntity extends JpaAuditedEntity {
  @Column(name = "project_id", nullable = false)
  private Long projectId;

  @Column(name = "generation_job_id")
  private Long generationJobId;

  @Column(name = "operation_type", nullable = false, length = 40)
  private String operationType;

  @Column(name = "estimate_min", nullable = false, precision = 19, scale = 6)
  private BigDecimal estimateMin;

  @Column(name = "estimate_max", nullable = false, precision = 19, scale = 6)
  private BigDecimal estimateMax;

  @Column(name = "max_authorized_cost", nullable = false, precision = 19, scale = 6)
  private BigDecimal maxAuthorizedCost;

  @Enumerated(EnumType.STRING)
  @Column(name = "confidence", nullable = false, length = 16)
  private EstimateConfidence confidence;

  public void apply(OperationPlan p) {
    projectId = p.getProjectId();
    generationJobId = p.getGenerationJobId();
    operationType = p.getOperationType();
    estimateMin = p.getEstimateMin();
    estimateMax = p.getEstimateMax();
    maxAuthorizedCost = p.getMaxAuthorizedCost();
    confidence = p.getConfidence();
  }
}
