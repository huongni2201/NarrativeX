package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.CharacterJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.CharacterJpaRepository;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CharacterPersistenceAdapter implements CharacterRepository {
  private final CharacterJpaRepository repository;

  @Override
  public java.util.Optional<Character> findOwnedById(Long id, String ownerId) {
    return repository
        .findByIdAndOwnerIdAndStatusNot(id, ownerId, CharacterStatus.ARCHIVED)
        .map(CharacterPersistenceMapper::toDomain);
  }

  @Override
  public java.util.Optional<Character> findOwnedByIdForUpdate(Long id, String ownerId) {
    return repository
        .findOwnedByIdForUpdate(id, ownerId, CharacterStatus.ARCHIVED)
        .map(CharacterPersistenceMapper::toDomain);
  }

  @Override
  public Character save(Character character) {
    CharacterJpaEntity entity =
        character.getId() == null
            ? buildJpaEntity(character)
            : repository
                .findById(character.getId())
                .map(existing -> {
                  OptimisticConcurrency.requireVersion(
                      character.getRowVersion(),
                      existing.getRowVersion(),
                      CharacterJpaEntity.class,
                      character.getId());
                  existing.apply(character);
                  return existing;
                })
                .orElseGet(() -> buildJpaEntity(character));
    return CharacterPersistenceMapper.toDomain(repository.save(entity));
  }

  private static CharacterJpaEntity buildJpaEntity(Character character) {
    return CharacterJpaEntity.builder()
        .ownerId(character.getOwnerId())
        .workspaceId(character.getWorkspaceId())
        .canonicalName(character.getCanonicalName())
        .aliases(new ArrayList<>(character.getAliases()))
        .status(character.getStatus())
        .build();
  }
}
