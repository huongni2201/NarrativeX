package com.narrativex.backend.feature.generation.infrastructure.persistence.repository;

import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.StageAttemptJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StageAttemptJpaRepository extends JpaRepository<StageAttemptJpaEntity, Long> {}
