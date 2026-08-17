package com.narrativex.backend.modules.character.infrastructure.persistence.adapter;

import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.domain.aggregate.CharacterVersion;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.modules.character.infrastructure.persistence.repository.CharacterVersionJpaRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class CharacterVersionPersistenceAdapter implements CharacterVersionRepository {
    private final CharacterVersionJpaRepository repository;

    public CharacterVersionPersistenceAdapter(CharacterVersionJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public int findMaxVersionNumberByCharacterId(Long characterId) {
        return repository.findMaxVersionNumberByCharacterId(characterId);
    }

    @Override
    public Optional<CharacterVersion> findOwnedById(Long characterVersionId, String ownerId) {
        return repository.findOwnedById(characterVersionId, ownerId).map(CharacterPersistenceMapper::toDomain);
    }

    @Override
    public CharacterVersion save(CharacterVersion version) {
        CharacterVersionJpaEntity entity = version.getId() == null
            ? new CharacterVersionJpaEntity(version)
            : repository.findById(version.getId()).orElseGet(() -> new CharacterVersionJpaEntity(version));
        entity.apply(version);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
