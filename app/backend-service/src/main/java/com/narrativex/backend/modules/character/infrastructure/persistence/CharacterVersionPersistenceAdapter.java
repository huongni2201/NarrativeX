package com.narrativex.backend.modules.character.infrastructure.persistence;

import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.domain.model.CharacterVersion;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
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
    public int countByCharacterId(Long characterId) {
        return repository.countByCharacterId(characterId);
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
