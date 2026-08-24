package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterAppearanceRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.OutfitVersionRow;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class CharacterPersistenceMissingRowTest {
  @Mock private CharacterMapper mapper;
  @Mock private CharacterMyBatisRowMapper rowMapper;

  @Test
  void persistedCharacterIsNotReinsertedWhenItsRowDisappeared() {
    UUID id = UUID.randomUUID();
    Character value =
        Character.rehydrate(id, 3L, "owner", null, "Mina", List.of(), CharacterStatus.ACTIVE);
    when(rowMapper.row(any(Character.class), any(CharacterMyBatisRowMapper.InstantPair.class)))
        .thenReturn(new CharacterRow());
    when(mapper.findCharacter(id)).thenReturn(null);

    assertThrows(
        OptimisticLockingFailureException.class,
        () -> new MyBatisCharacterPersistenceAdapter(mapper, rowMapper).save(value));

    verify(mapper, never()).insertCharacter(any(CharacterRow.class));
  }

  @Test
  void persistedCharacterVersionIsNotReinsertedWhenItsRowDisappeared() {
    UUID id = UUID.randomUUID();
    CharacterVersion value =
        CharacterVersion.rehydrate(
            id,
            2L,
            UUID.randomUUID(),
            1,
            "bible",
            "visual prompt",
            CharacterVersionStatus.DRAFT,
            null,
            null);
    when(rowMapper.row(
            any(CharacterVersion.class), any(CharacterMyBatisRowMapper.InstantPair.class)))
        .thenReturn(new CharacterVersionRow());
    when(mapper.findCharacterVersion(id)).thenReturn(null);

    assertThrows(
        OptimisticLockingFailureException.class,
        () -> new MyBatisCharacterVersionPersistenceAdapter(mapper, rowMapper).save(value));

    verify(mapper, never()).insertCharacterVersion(any(CharacterVersionRow.class));
  }

  @Test
  void persistedOutfitVersionIsNotReinsertedWhenItsRowDisappeared() {
    UUID id = UUID.randomUUID();
    OutfitVersion value =
        OutfitVersion.rehydrate(
            id,
            2L,
            UUID.randomUUID(),
            1,
            "Default",
            "description",
            "prompt",
            OutfitVersionStatus.DRAFT);
    when(rowMapper.row(any(OutfitVersion.class), any(CharacterMyBatisRowMapper.InstantPair.class)))
        .thenReturn(new OutfitVersionRow());
    when(mapper.findOutfit(id)).thenReturn(null);

    assertThrows(
        OptimisticLockingFailureException.class,
        () -> new MyBatisOutfitVersionPersistenceAdapter(mapper, rowMapper).save(value));

    verify(mapper, never()).insertOutfit(any(OutfitVersionRow.class));
  }

  @Test
  void persistedAppearanceIsNotReinsertedWhenItsRowDisappeared() {
    UUID id = UUID.randomUUID();
    CharacterAppearance value =
        CharacterAppearance.rehydrate(
            id,
            5L,
            UUID.randomUUID(),
            UUID.randomUUID(),
            "chapter-1",
            null,
            null,
            null,
            null,
            null,
            null);
    when(rowMapper.row(
            any(CharacterAppearance.class), any(CharacterMyBatisRowMapper.InstantPair.class)))
        .thenReturn(new CharacterAppearanceRow());
    when(mapper.findAppearance(id)).thenReturn(null);

    assertThrows(
        OptimisticLockingFailureException.class,
        () -> new MyBatisCharacterAppearancePersistenceAdapter(mapper, rowMapper).save(value));

    verify(mapper, never()).insertAppearance(any(CharacterAppearanceRow.class));
  }
}
