package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.OutfitVersionJpaRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class OutfitVersionPersistenceAdapter implements OutfitVersionRepository {
    private final OutfitVersionJpaRepository repository;
    public OutfitVersionPersistenceAdapter(OutfitVersionJpaRepository repository) { this.repository = repository; }
    @Override public int findMaxVersionNumberByCharacterId(Long characterId) { return repository.findMaxVersionNumberByCharacterId(characterId); }
    @Override public Optional<OutfitVersion> findOwnedById(Long id, String ownerId) { return repository.findOwnedById(id, ownerId, CharacterStatus.ARCHIVED).map(CharacterPersistenceMapper::toDomain); }
    @Override public OutfitVersion save(OutfitVersion outfit) {
        OutfitVersionJpaEntity entity = outfit.getId() == null ? new OutfitVersionJpaEntity(outfit) : repository.findById(outfit.getId()).orElseGet(() -> new OutfitVersionJpaEntity(outfit));
        entity.apply(outfit);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
