package com.narrativex.backend.modules.generation.infrastructure.persistence;

import com.narrativex.backend.modules.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.modules.generation.domain.model.OperationPlan;
import com.narrativex.backend.modules.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;
import com.narrativex.backend.modules.generation.infrastructure.persistence.repository.OperationPlanJpaRepository;
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
