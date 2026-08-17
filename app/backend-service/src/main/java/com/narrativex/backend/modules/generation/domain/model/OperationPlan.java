package com.narrativex.backend.modules.generation.domain.model;

import com.narrativex.backend.shared.domain.AggregateRoot;
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
        this.projectId = Objects.requireNonNull(projectId, "projectId");
        this.operationType = Objects.requireNonNull(operationType, "operationType");
        this.estimateMin = Objects.requireNonNull(estimateMin, "estimateMin");
        this.estimateMax = Objects.requireNonNull(estimateMax, "estimateMax");
        this.maxAuthorizedCost = Objects.requireNonNull(maxAuthorizedCost, "maxAuthorizedCost");
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
}
