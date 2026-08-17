package com.narrativex.backend.modules.generation.infrastructure.persistence.repository;

import com.narrativex.backend.modules.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationPlanJpaRepository extends JpaRepository<OperationPlanJpaEntity, Long> {
}
