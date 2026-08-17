package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.CharacterVersionJpaRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class CharacterVersionPersistenceAdapter implements CharacterVersionRepository {
    private final CharacterVersionJpaRepository repository;
    public CharacterVersionPersistenceAdapter(CharacterVersionJpaRepository repository) { this.repository = repository; }
    @Override public int findMaxVersionNumberByCharacterId(Long characterId) { return repository.findMaxVersionNumberByCharacterId(characterId); }
    @Override public Optional<CharacterVersion> findOwnedById(Long id, String ownerId) { return repository.findOwnedById(id, ownerId).map(CharacterPersistenceMapper::toDomain); }
    @Override public CharacterVersion save(CharacterVersion version) {
        CharacterVersionJpaEntity entity = version.getId() == null ? new CharacterVersionJpaEntity(version) : repository.findById(version.getId()).orElseGet(() -> new CharacterVersionJpaEntity(version));
        entity.apply(version);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
