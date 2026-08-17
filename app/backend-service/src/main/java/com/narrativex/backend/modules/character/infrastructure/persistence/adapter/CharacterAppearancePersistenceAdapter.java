package com.narrativex.backend.modules.character.infrastructure.persistence.adapter;

import com.narrativex.backend.modules.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.modules.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterAppearanceJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.modules.character.infrastructure.persistence.repository.CharacterAppearanceJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class CharacterAppearancePersistenceAdapter implements CharacterAppearanceRepository {
    private final CharacterAppearanceJpaRepository repository;
    public CharacterAppearancePersistenceAdapter(CharacterAppearanceJpaRepository repository) { this.repository = repository; }
    @Override public CharacterAppearance save(CharacterAppearance appearance) {
        CharacterAppearanceJpaEntity entity = appearance.getId() == null ? new CharacterAppearanceJpaEntity(appearance) : repository.findById(appearance.getId()).orElseGet(() -> new CharacterAppearanceJpaEntity(appearance));
        entity.apply(appearance);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
