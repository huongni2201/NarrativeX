package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterAppearanceRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCharacterAppearancePersistenceAdapter implements CharacterAppearanceRepository {
  private final CharacterMapper mapper;
  private final CharacterMyBatisRowMapper rowMapper;

  @Override
  public CharacterAppearance save(CharacterAppearance value) {
    CharacterAppearanceRow row = rowMapper.row(value, CharacterMyBatisRowMapper.InstantPair.now());
    if (value.getId() == null) {
      row.setId((UUID) null);
      row.setRowVersion(0L);
      UUID id = mapper.insertAppearance(row);
      return rowMapper.toDomain(mapper.findAppearance(id));
    }
    CharacterAppearanceRow existing = mapper.findAppearance(value.getId());
    OptimisticConcurrency.requirePresent(existing, CharacterAppearance.class, value.getId());
    OptimisticConcurrency.requireVersion(
        value.getRowVersion(), existing.getRowVersion(), CharacterAppearance.class, value.getId());
    if (mapper.updateAppearance(row) != 1)
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Character appearance was modified concurrently");
    return rowMapper.toDomain(mapper.findAppearance(value.getId()));
  }
}
