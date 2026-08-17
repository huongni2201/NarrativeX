package com.narrativex.backend.modules.generation.domain;

import com.narrativex.backend.modules.project.domain.Project;
import com.narrativex.backend.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "operation_plans")
public class OperationPlan extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_operation_plans_project"))
    private Project project;

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
    private EstimateConfidence confidence = EstimateConfidence.LOW;

    protected OperationPlan() {
    }

    public OperationPlan(Project project, String operationType, BigDecimal estimateMin,
                         BigDecimal estimateMax, BigDecimal maxAuthorizedCost) {
        this.project = project;
        this.operationType = operationType;
        this.estimateMin = estimateMin;
        this.estimateMax = estimateMax;
        this.maxAuthorizedCost = maxAuthorizedCost;
    }
}
