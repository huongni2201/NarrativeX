package com.narrativex.backend.feature.generation.infrastructure.persistence.mapper;

import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;

public final class GenerationPersistenceMapper {
  private GenerationPersistenceMapper() {}

  public static OperationPlan toDomain(OperationPlanJpaEntity entity) {
    return OperationPlan.rehydrate(
        entity.getId(),
        entity.getRowVersion(),
        entity.getProjectId(),
        entity.getGenerationJobId(),
        entity.getOperationType(),
        entity.getEstimateMin(),
        entity.getEstimateMax(),
        entity.getMaxAuthorizedCost(),
        entity.getConfidence());
  }
}
