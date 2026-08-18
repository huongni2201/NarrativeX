package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.CharacterAppearanceJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.CharacterAppearanceJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CharacterAppearancePersistenceAdapter implements CharacterAppearanceRepository {
  private final CharacterAppearanceJpaRepository repository;

  @Override
  public CharacterAppearance save(CharacterAppearance appearance) {
    CharacterAppearanceJpaEntity entity =
        appearance.getId() == null
            ? buildJpaEntity(appearance)
            : repository
                .findById(appearance.getId())
                .map(existing -> {
                  existing.apply(appearance);
                  return existing;
                })
                .orElseGet(() -> buildJpaEntity(appearance));
    return CharacterPersistenceMapper.toDomain(repository.save(entity));
  }

  private static CharacterAppearanceJpaEntity buildJpaEntity(CharacterAppearance appearance) {
    return CharacterAppearanceJpaEntity.builder()
        .characterId(appearance.getCharacterId())
        .projectId(appearance.getProjectId())
        .timelineKey(appearance.getTimelineKey())
        .ageState(appearance.getAgeState())
        .hairstyle(appearance.getHairstyle())
        .injury(appearance.getInjury())
        .wardrobeContext(appearance.getWardrobeContext())
        .appearancePrompt(appearance.getAppearancePrompt())
        .outfitVersionId(appearance.getOutfitVersionId())
        .build();
  }
}
