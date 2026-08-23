package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

/** Cost/authorization plan aggregate persisted before expensive work is submitted. */
public final class OperationPlan extends AggregateRoot {
  private final UUID projectId;
  private final UUID generationJobId;
  private final String operationType;
  private final BigDecimal estimateMin;
  private final BigDecimal estimateMax;
  private final BigDecimal maxAuthorizedCost;
  private final EstimateConfidence confidence;

  private OperationPlan(
      UUID id,
      long rowVersion,
      UUID projectId,
      UUID generationJobId,
      String operationType,
      BigDecimal estimateMin,
      BigDecimal estimateMax,
      BigDecimal maxAuthorizedCost,
      EstimateConfidence confidence) {
    super(id, rowVersion);
    this.projectId = Objects.requireNonNull(projectId, "projectId");
    this.generationJobId = generationJobId;
    if (operationType == null || operationType.isBlank())
      throw new IllegalArgumentException("operationType must not be blank");
    this.operationType = operationType;
    this.estimateMin = nonNegative(estimateMin, "estimateMin");
    this.estimateMax = nonNegative(estimateMax, "estimateMax");
    this.maxAuthorizedCost = nonNegative(maxAuthorizedCost, "maxAuthorizedCost");
    if (this.estimateMin.compareTo(this.estimateMax) > 0)
      throw new IllegalArgumentException("estimateMin must not exceed estimateMax");
    this.confidence = Objects.requireNonNull(confidence, "confidence");
  }

  public static OperationPlan create(
      UUID projectId,
      String operationType,
      BigDecimal estimateMin,
      BigDecimal estimateMax,
      BigDecimal maxAuthorizedCost) {
    return new OperationPlan(
        null, 0L, projectId, null, operationType, estimateMin, estimateMax, maxAuthorizedCost,
        EstimateConfidence.LOW);
  }

  public static OperationPlan rehydrate(
      UUID id,
      long rowVersion,
      UUID projectId,
      String operationType,
      BigDecimal estimateMin,
      BigDecimal estimateMax,
      BigDecimal maxAuthorizedCost,
      EstimateConfidence confidence) {
    return rehydrate(
        id, rowVersion, projectId, null, operationType, estimateMin, estimateMax,
        maxAuthorizedCost, confidence);
  }

  public static OperationPlan rehydrate(
      UUID id,
      long rowVersion,
      UUID projectId,
      UUID generationJobId,
      String operationType,
      BigDecimal estimateMin,
      BigDecimal estimateMax,
      BigDecimal maxAuthorizedCost,
      EstimateConfidence confidence) {
    return new OperationPlan(
        id, rowVersion, projectId, generationJobId, operationType, estimateMin, estimateMax,
        maxAuthorizedCost, confidence);
  }

  public OperationPlan withGenerationJobId(UUID jobId) {
    return new OperationPlan(
        getId(), getRowVersion(), projectId, Objects.requireNonNull(jobId, "jobId"),
        operationType, estimateMin, estimateMax, maxAuthorizedCost, confidence);
  }

  public UUID getProjectId() { return projectId; }
  public UUID getGenerationJobId() { return generationJobId; }
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
