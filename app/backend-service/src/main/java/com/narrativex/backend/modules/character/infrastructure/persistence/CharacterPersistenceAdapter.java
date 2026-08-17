package com.narrativex.backend.modules.character.infrastructure.persistence;

import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.domain.model.Character;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterJpaEntity;
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
                com.narrativex.backend.modules.character.domain.model.CharacterStatus.ARCHIVED)
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
