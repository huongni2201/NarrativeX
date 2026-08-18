package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.CharacterVersionJpaRepository;
import java.util.ArrayList;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CharacterVersionPersistenceAdapter implements CharacterVersionRepository {
  private final CharacterVersionJpaRepository repository;

  @Override
  public int findMaxVersionNumberByCharacterId(Long characterId) {
    return repository.findMaxVersionNumberByCharacterId(characterId);
  }

  @Override
  public Optional<CharacterVersion> findOwnedById(Long id, String ownerId) {
    return repository.findOwnedById(id, ownerId).map(CharacterPersistenceMapper::toDomain);
  }

  @Override
  public CharacterVersion save(CharacterVersion version) {
    CharacterVersionJpaEntity entity =
        version.getId() == null
            ? buildJpaEntity(version)
            : repository
                .findById(version.getId())
                .map(existing -> {
                  existing.apply(version);
                  return existing;
                })
                .orElseGet(() -> buildJpaEntity(version));
    return CharacterPersistenceMapper.toDomain(repository.save(entity));
  }

  private static CharacterVersionJpaEntity buildJpaEntity(CharacterVersion version) {
    return CharacterVersionJpaEntity.builder()
        .characterId(version.getCharacterId())
        .versionNumber(version.getVersionNumber())
        .bible(version.getBible())
        .visualPrompt(version.getVisualPrompt())
        .masterAssetId(version.getMasterAssetId())
        .referenceAssetIds(new ArrayList<>(version.getReferenceAssetIds()))
        .status(version.getStatus())
        .lockedAt(version.getLockedAt())
        .lockedBy(version.getLockedBy())
        .build();
  }
}
