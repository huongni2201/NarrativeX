package com.narrativex.backend.feature.character.infrastructure.persistence.repository;

import com.narrativex.backend.feature.character.infrastructure.persistence.entity.CharacterAppearanceJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterAppearanceJpaRepository extends JpaRepository<CharacterAppearanceJpaEntity, Long> {
}
