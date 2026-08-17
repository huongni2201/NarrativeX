package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mapper.GenerationPersistenceMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.OperationPlanJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class OperationPlanPersistenceAdapter implements OperationPlanRepository {

    private final OperationPlanJpaRepository repository;

    public OperationPlanPersistenceAdapter(OperationPlanJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public OperationPlan save(OperationPlan operationPlan) {
        OperationPlanJpaEntity entity = operationPlan.getId() == null
            ? new OperationPlanJpaEntity(operationPlan)
            : repository.findById(operationPlan.getId()).orElseGet(() -> new OperationPlanJpaEntity(operationPlan));
        entity.apply(operationPlan);
        return GenerationPersistenceMapper.toDomain(repository.save(entity));
    }
}
