package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mapper.GenerationPersistenceMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.OperationPlanJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OperationPlanPersistenceAdapter implements OperationPlanRepository {

  private final OperationPlanJpaRepository repository;

  @Override
  public OperationPlan save(OperationPlan operationPlan) {
    return operationPlan.getId() == null ? create(operationPlan) : update(operationPlan);
  }

  private OperationPlan create(OperationPlan operationPlan) {
    return GenerationPersistenceMapper.toDomain(repository.save(buildJpaEntity(operationPlan)));
  }

  private OperationPlan update(OperationPlan operationPlan) {
    OperationPlanJpaEntity existing =
        repository
            .findById(operationPlan.getId())
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        "OperationPlan "
                            + operationPlan.getId()
                            + " no longer exists while applying an update"));
    OptimisticConcurrency.requireVersion(
        operationPlan.getRowVersion(),
        existing.getRowVersion(),
        OperationPlanJpaEntity.class,
        operationPlan.getId());
    existing.apply(operationPlan);
    return GenerationPersistenceMapper.toDomain(repository.save(existing));
  }

  private static OperationPlanJpaEntity buildJpaEntity(OperationPlan operationPlan) {
    return OperationPlanJpaEntity.builder()
        .projectId(operationPlan.getProjectId())
        .generationJobId(operationPlan.getGenerationJobId())
        .operationType(operationPlan.getOperationType())
        .estimateMin(operationPlan.getEstimateMin())
        .estimateMax(operationPlan.getEstimateMax())
        .maxAuthorizedCost(operationPlan.getMaxAuthorizedCost())
        .confidence(operationPlan.getConfidence())
        .build();
  }
}
