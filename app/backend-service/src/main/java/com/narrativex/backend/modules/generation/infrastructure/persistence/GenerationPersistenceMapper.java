package com.narrativex.backend.modules.generation.infrastructure.persistence;

import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.modules.generation.domain.model.OperationPlan;
import com.narrativex.backend.modules.generation.infrastructure.persistence.entity.GenerationJobJpaEntity;
import com.narrativex.backend.modules.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;

public final class GenerationPersistenceMapper {

    private GenerationPersistenceMapper() {
    }

    public static GenerationJob toDomain(GenerationJobJpaEntity entity) {
        return GenerationJob.rehydrate(entity.getId(), entity.getRowVersion(), entity.getJobId(),
            entity.getProjectId(), entity.getType(), entity.getStatus(), entity.getResourceClass(),
            entity.getProgress(), entity.getCurrentStep(), entity.getErrorCode(), entity.getRequestedByUserId(),
            entity.getBilledToUserId());
    }

    public static OperationPlan toDomain(OperationPlanJpaEntity entity) {
        return OperationPlan.rehydrate(entity.getId(), entity.getRowVersion(), entity.getProjectId(),
            entity.getOperationType(), entity.getEstimateMin(), entity.getEstimateMax(),
            entity.getMaxAuthorizedCost(), entity.getConfidence());
    }
}
