package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;

public interface OperationPlanRepository {
    OperationPlan save(OperationPlan operationPlan);
}
