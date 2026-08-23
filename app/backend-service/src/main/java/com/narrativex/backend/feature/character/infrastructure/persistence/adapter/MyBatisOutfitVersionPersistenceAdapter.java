package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.OutfitVersionRow;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisOutfitVersionPersistenceAdapter implements OutfitVersionRepository {
  private final CharacterMapper mapper;
  private final CharacterMyBatisRowMapper rowMapper;

  @Override
  public int findMaxVersionNumberByCharacterId(UUID id) {
    return mapper.maxOutfitVersion(id);
  }

  @Override
  public Optional<OutfitVersion> findOwnedById(UUID id, String ownerId) {
    return Optional.ofNullable(mapper.findOwnedOutfit(id, ownerId, CharacterStatus.ARCHIVED.name()))
        .map(rowMapper::toDomain);
  }

  @Override
  public OutfitVersion save(OutfitVersion value) {
    OutfitVersionRow row = rowMapper.row(value, CharacterMyBatisRowMapper.InstantPair.now());
    if (value.getId() == null) {
      row.setId(null);
      row.setRowVersion(0);
      UUID id = mapper.insertOutfit(row);
      return rowMapper.toDomain(mapper.findOutfit(id));
    }
    OutfitVersionRow existing = mapper.findOutfit(value.getId());
    if (existing == null) {
      row.setId(null);
      row.setRowVersion(0);
      UUID id = mapper.insertOutfit(row);
      return rowMapper.toDomain(mapper.findOutfit(id));
    }
    OptimisticConcurrency.requireVersion(
        value.getRowVersion(), existing.getRowVersion(), OutfitVersion.class, value.getId());
    if (mapper.updateOutfit(row) != 1)
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Outfit version was modified concurrently");
    return rowMapper.toDomain(mapper.findOutfit(value.getId()));
  }
}
