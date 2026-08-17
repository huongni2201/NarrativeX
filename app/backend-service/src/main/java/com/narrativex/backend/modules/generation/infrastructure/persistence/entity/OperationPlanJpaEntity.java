package com.narrativex.backend.modules.generation.infrastructure.persistence.entity;

import com.narrativex.backend.modules.generation.domain.aggregate.EstimateConfidence;
import com.narrativex.backend.modules.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "operation_plans")
public class OperationPlanJpaEntity extends JpaAuditedEntity {

    @Column(name = "project_id", nullable = false)
    private Long projectId;

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

    protected OperationPlanJpaEntity() {
    }

    public OperationPlanJpaEntity(OperationPlan plan) {
        apply(plan);
    }

    public void apply(OperationPlan plan) {
        projectId = plan.getProjectId();
        operationType = plan.getOperationType();
        estimateMin = plan.getEstimateMin();
        estimateMax = plan.getEstimateMax();
        maxAuthorizedCost = plan.getMaxAuthorizedCost();
        confidence = plan.getConfidence();
    }

    public Long getProjectId() { return projectId; }
    public String getOperationType() { return operationType; }
    public BigDecimal getEstimateMin() { return estimateMin; }
    public BigDecimal getEstimateMax() { return estimateMax; }
    public BigDecimal getMaxAuthorizedCost() { return maxAuthorizedCost; }
    public EstimateConfidence getConfidence() { return confidence; }
}
