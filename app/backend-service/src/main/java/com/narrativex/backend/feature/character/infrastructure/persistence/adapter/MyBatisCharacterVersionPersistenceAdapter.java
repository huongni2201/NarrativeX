package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionRow;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCharacterVersionPersistenceAdapter implements CharacterVersionRepository {
  private final CharacterMapper mapper;
  private final CharacterMyBatisRowMapper rowMapper;

  @Override
  public int findMaxVersionNumberByCharacterId(UUID id) {
    return mapper.maxCharacterVersion(id);
  }

  @Override
  public Optional<CharacterVersion> findOwnedById(UUID id, String ownerId) {
    return Optional.ofNullable(mapper.findOwnedVersion(id, ownerId)).map(rowMapper::toDomain);
  }

  @Override
  public CharacterVersion save(CharacterVersion value) {
    CharacterVersionRow row = rowMapper.row(value, CharacterMyBatisRowMapper.InstantPair.now());
    if (value.getId() == null) {
      row.setId(null);
      row.setRowVersion(0);
      UUID id = mapper.insertCharacterVersion(row);
      return rowMapper.toDomain(mapper.findCharacterVersion(id));
    }
    CharacterVersionRow existing = mapper.findCharacterVersion(value.getId());
    if (existing == null) {
      row.setId(null);
      row.setRowVersion(0);
      UUID id = mapper.insertCharacterVersion(row);
      return rowMapper.toDomain(mapper.findCharacterVersion(id));
    }
    OptimisticConcurrency.requireVersion(
        value.getRowVersion(), existing.getRowVersion(), CharacterVersion.class, value.getId());
    if (mapper.updateCharacterVersion(row) != 1)
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Character version was modified concurrently");
    return rowMapper.toDomain(mapper.findCharacterVersion(value.getId()));
  }
}
