package com.narrativex.backend.modules.generation.application.port.out;

import com.narrativex.backend.modules.generation.domain.aggregate.OperationPlan;

public interface OperationPlanRepository {
    OperationPlan save(OperationPlan operationPlan);
}
