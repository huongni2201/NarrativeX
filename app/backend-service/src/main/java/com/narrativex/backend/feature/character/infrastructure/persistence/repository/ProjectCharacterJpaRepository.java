package com.narrativex.backend.feature.character.infrastructure.persistence.repository;

import com.narrativex.backend.feature.character.infrastructure.persistence.entity.ProjectCharacterJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectCharacterJpaRepository
    extends JpaRepository<ProjectCharacterJpaEntity, Long> {}
