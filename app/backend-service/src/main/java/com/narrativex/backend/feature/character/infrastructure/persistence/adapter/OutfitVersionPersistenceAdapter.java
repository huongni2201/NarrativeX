package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.OutfitVersionJpaRepository;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OutfitVersionPersistenceAdapter implements OutfitVersionRepository {
  private final OutfitVersionJpaRepository repository;

  @Override
  public int findMaxVersionNumberByCharacterId(Long characterId) {
    return repository.findMaxVersionNumberByCharacterId(characterId);
  }

  @Override
  public Optional<OutfitVersion> findOwnedById(Long id, String ownerId) {
    return repository
        .findOwnedById(id, ownerId, CharacterStatus.ARCHIVED)
        .map(CharacterPersistenceMapper::toDomain);
  }

  @Override
  public OutfitVersion save(OutfitVersion outfit) {
    OutfitVersionJpaEntity entity =
        outfit.getId() == null
            ? buildJpaEntity(outfit)
            : repository
                .findById(outfit.getId())
                .map(existing -> {
                  OptimisticConcurrency.requireVersion(
                      outfit.getRowVersion(),
                      existing.getRowVersion(),
                      OutfitVersionJpaEntity.class,
                      outfit.getId());
                  existing.apply(outfit);
                  return existing;
                })
                .orElseGet(() -> buildJpaEntity(outfit));
    return CharacterPersistenceMapper.toDomain(repository.save(entity));
  }

  private static OutfitVersionJpaEntity buildJpaEntity(OutfitVersion outfit) {
    return OutfitVersionJpaEntity.builder()
        .characterId(outfit.getCharacterId())
        .versionNumber(outfit.getVersionNumber())
        .name(outfit.getName())
        .description(outfit.getDescription())
        .prompt(outfit.getPrompt())
        .status(outfit.getStatus())
        .build();
  }
}
