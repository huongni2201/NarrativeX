package com.narrativex.backend.modules.character.infrastructure.persistence;

import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.domain.model.OutfitVersion;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.repository.OutfitVersionJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class OutfitVersionPersistenceAdapter implements OutfitVersionRepository {
    private final OutfitVersionJpaRepository repository;

    public OutfitVersionPersistenceAdapter(OutfitVersionJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public int countByCharacterId(Long characterId) {
        return repository.countByCharacterId(characterId);
    }

    @Override
    public OutfitVersion save(OutfitVersion outfitVersion) {
        OutfitVersionJpaEntity entity = outfitVersion.getId() == null
            ? new OutfitVersionJpaEntity(outfitVersion)
            : repository.findById(outfitVersion.getId()).orElseGet(() -> new OutfitVersionJpaEntity(outfitVersion));
        entity.apply(outfitVersion);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
