package com.narrativex.backend.modules.character.infrastructure.persistence.adapter;

import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.domain.aggregate.OutfitVersion;
import com.narrativex.backend.modules.character.domain.aggregate.CharacterStatus;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.modules.character.infrastructure.persistence.repository.OutfitVersionJpaRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class OutfitVersionPersistenceAdapter implements OutfitVersionRepository {
    private final OutfitVersionJpaRepository repository;

    public OutfitVersionPersistenceAdapter(OutfitVersionJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public int findMaxVersionNumberByCharacterId(Long characterId) {
        return repository.findMaxVersionNumberByCharacterId(characterId);
    }

    @Override
    public Optional<OutfitVersion> findOwnedById(Long outfitVersionId, String ownerId) {
        return repository.findOwnedById(outfitVersionId, ownerId, CharacterStatus.ARCHIVED)
            .map(CharacterPersistenceMapper::toDomain);
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
