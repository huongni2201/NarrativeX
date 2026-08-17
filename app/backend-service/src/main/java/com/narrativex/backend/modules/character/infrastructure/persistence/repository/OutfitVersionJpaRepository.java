package com.narrativex.backend.modules.character.infrastructure.persistence.repository;

import com.narrativex.backend.modules.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutfitVersionJpaRepository extends JpaRepository<OutfitVersionJpaEntity, Long> {
    int countByCharacterId(Long characterId);
}
