package com.narrativex.backend.modules.generation.repository;

import com.narrativex.backend.modules.generation.domain.OperationPlan;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationPlanRepository extends JpaRepository<OperationPlan, Long> {
}
