package com.narrativex.backend.modules.character.infrastructure.persistence.adapter;

import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.modules.character.infrastructure.persistence.repository.CharacterJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class CharacterPersistenceAdapter implements CharacterRepository {
    private final CharacterJpaRepository repository;

    public CharacterPersistenceAdapter(CharacterJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public java.util.Optional<Character> findOwnedById(Long characterId, String ownerId) {
        return repository.findByIdAndOwnerIdAndStatusNot(characterId, ownerId,
                com.narrativex.backend.modules.character.domain.aggregate.CharacterStatus.ARCHIVED)
            .map(CharacterPersistenceMapper::toDomain);
    }

    @Override
    public java.util.Optional<Character> findOwnedByIdForUpdate(Long characterId, String ownerId) {
        return repository.findOwnedByIdForUpdate(characterId, ownerId,
                com.narrativex.backend.modules.character.domain.aggregate.CharacterStatus.ARCHIVED)
            .map(CharacterPersistenceMapper::toDomain);
    }

    @Override
    public Character save(Character character) {
        CharacterJpaEntity entity = character.getId() == null
            ? new CharacterJpaEntity(character)
            : repository.findById(character.getId()).orElseGet(() -> new CharacterJpaEntity(character));
        entity.apply(character);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
