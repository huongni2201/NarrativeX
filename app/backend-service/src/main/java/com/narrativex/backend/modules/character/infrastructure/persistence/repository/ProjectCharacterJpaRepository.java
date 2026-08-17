package com.narrativex.backend.modules.character.infrastructure.persistence.repository;

import com.narrativex.backend.modules.character.infrastructure.persistence.entity.ProjectCharacterJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectCharacterJpaRepository extends JpaRepository<ProjectCharacterJpaEntity, Long> {
}
