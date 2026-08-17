package com.narrativex.backend.modules.generation.domain.aggregate;

import com.narrativex.backend.modules.common.domain.AggregateRoot;
import com.narrativex.backend.modules.generation.domain.enums.EstimateConfidence;
import java.math.BigDecimal;
import java.util.Objects;

/** Cost/authorization plan aggregate persisted before expensive work is submitted. */
public final class OperationPlan extends AggregateRoot {
    private final Long projectId;
    private final String operationType;
    private final BigDecimal estimateMin;
    private final BigDecimal estimateMax;
    private final BigDecimal maxAuthorizedCost;
    private final EstimateConfidence confidence;

    private OperationPlan(Long id, long rowVersion, Long projectId, String operationType,
                          BigDecimal estimateMin, BigDecimal estimateMax, BigDecimal maxAuthorizedCost,
                          EstimateConfidence confidence) {
        super(id, rowVersion);
        if (projectId == null || projectId <= 0) throw new IllegalArgumentException("projectId must be positive");
        this.projectId = projectId;
        if (operationType == null || operationType.isBlank()) throw new IllegalArgumentException("operationType must not be blank");
        this.operationType = operationType;
        this.estimateMin = nonNegative(estimateMin, "estimateMin");
        this.estimateMax = nonNegative(estimateMax, "estimateMax");
        this.maxAuthorizedCost = nonNegative(maxAuthorizedCost, "maxAuthorizedCost");
        if (this.estimateMin.compareTo(this.estimateMax) > 0) throw new IllegalArgumentException("estimateMin must not exceed estimateMax");
        this.confidence = Objects.requireNonNull(confidence, "confidence");
    }

    public static OperationPlan create(Long projectId, String operationType, BigDecimal estimateMin,
                                       BigDecimal estimateMax, BigDecimal maxAuthorizedCost) {
        return new OperationPlan(null, 0L, projectId, operationType, estimateMin, estimateMax,
            maxAuthorizedCost, EstimateConfidence.LOW);
    }

    public static OperationPlan rehydrate(Long id, long rowVersion, Long projectId, String operationType,
                                          BigDecimal estimateMin, BigDecimal estimateMax,
                                          BigDecimal maxAuthorizedCost, EstimateConfidence confidence) {
        return new OperationPlan(id, rowVersion, projectId, operationType, estimateMin, estimateMax,
            maxAuthorizedCost, confidence);
    }

    public Long getProjectId() { return projectId; }
    public String getOperationType() { return operationType; }
    public BigDecimal getEstimateMin() { return estimateMin; }
    public BigDecimal getEstimateMax() { return estimateMax; }
    public BigDecimal getMaxAuthorizedCost() { return maxAuthorizedCost; }
    public EstimateConfidence getConfidence() { return confidence; }

    private static BigDecimal nonNegative(BigDecimal value, String field) {
        Objects.requireNonNull(value, field);
        if (value.signum() < 0) throw new IllegalArgumentException(field + " must not be negative");
        return value;
    }
}
