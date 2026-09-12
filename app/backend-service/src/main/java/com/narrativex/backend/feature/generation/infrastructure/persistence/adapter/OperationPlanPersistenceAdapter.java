package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OperationPlanMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OperationPlanRow;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OperationPlanPersistenceAdapter implements OperationPlanRepository {
  private final OperationPlanMapper mapper;

  @Override
  public OperationPlan save(OperationPlan operationPlan) {
    return operationPlan.getId() == null ? create(operationPlan) : update(operationPlan);
  }

  private OperationPlan create(OperationPlan operationPlan) {
    UUID id = mapper.insert(toRow(operationPlan));
    if (id == null) throw new IllegalStateException("Inserted operation plan did not return an id");
    OperationPlanRow inserted = mapper.findById(id);
    if (inserted == null) {
      throw new IllegalStateException("Inserted operation plan " + id + " disappeared");
    }
    return toDomain(inserted);
  }

  private OperationPlan update(OperationPlan operationPlan) {
    if (mapper.updateCas(toRow(operationPlan)) != 1) {
      OperationPlanRow current = mapper.findById(operationPlan.getId());
      if (current == null) {
        throw new ResourceNotFoundException(
            "OperationPlan "
                + operationPlan.getId()
                + " no longer exists while applying an update");
      }
      throw new OptimisticLockingFailureException("Operation plan was modified concurrently");
    }
    OperationPlanRow updated = mapper.findById(operationPlan.getId());
    if (updated == null) {
      throw new ResourceNotFoundException(
          "OperationPlan " + operationPlan.getId() + " disappeared after applying an update");
    }
    return toDomain(updated);
  }

  private static OperationPlanRow toRow(OperationPlan plan) {
    return new OperationPlanRow(
        plan.getId(),
        plan.getRowVersion(),
        plan.getProjectId(),
        plan.getGenerationJobId(),
        plan.getOperationType());
  }

  private static OperationPlan toDomain(OperationPlanRow row) {
    return OperationPlan.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getProjectId(),
        row.getGenerationJobId(),
        row.getOperationType());
  }
}
