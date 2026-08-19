package com.narrativex.backend.feature.generation.infrastructure.persistence.mapper;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.GenerationJobJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;

public final class GenerationPersistenceMapper {
  private GenerationPersistenceMapper() {}

  public static GenerationJob toDomain(GenerationJobJpaEntity entity) {
    return GenerationJob.rehydrate(
        entity.getId(), entity.getRowVersion(), entity.getJobId(), entity.getProjectId(),
        entity.getType(), entity.getStatus(), entity.getResourceClass(), entity.getProgress(),
        entity.getCurrentStep(), entity.getErrorCode(), entity.getRequestedByUserId(),
        entity.getBilledToUserId(), entity.getStoryVersionId(), entity.getChapterId(),
        entity.getStoryboardRevisionId(), entity.getChapterRowVersion(), entity.getSourceHash(),
        entity.getSourceText(), entity.getSourceLanguage(), entity.getIdempotencyKey());
  }

  public static OperationPlan toDomain(OperationPlanJpaEntity entity) {
    return OperationPlan.rehydrate(
        entity.getId(), entity.getRowVersion(), entity.getProjectId(), entity.getGenerationJobId(),
        entity.getOperationType(), entity.getEstimateMin(), entity.getEstimateMax(),
        entity.getMaxAuthorizedCost(), entity.getConfidence());
  }
}
