package com.narrativex.backend.feature.generation.infrastructure.persistence.repository;

import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationPlanJpaRepository extends JpaRepository<OperationPlanJpaEntity, Long> {}
