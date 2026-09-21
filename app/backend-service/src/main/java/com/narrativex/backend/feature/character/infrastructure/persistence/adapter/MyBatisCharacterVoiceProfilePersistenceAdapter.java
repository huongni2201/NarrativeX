package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterVoiceProfileRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVoiceProfileMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVoiceProfileRow;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCharacterVoiceProfilePersistenceAdapter
    implements CharacterVoiceProfileRepository {
  private final CharacterVoiceProfileMapper mapper;
  private final CharacterMyBatisRowMapper rowMapper;

  @Override
  public Optional<CharacterVoiceProfile> findById(UUID id) {
    return Optional.ofNullable(mapper.findById(id)).map(rowMapper::toDomain);
  }

  @Override
  public Optional<CharacterVoiceProfile> findPinnedByCharacterId(UUID characterId) {
    return Optional.ofNullable(mapper.findPinnedByCharacterId(characterId))
        .map(rowMapper::toDomain);
  }

  @Override
  public List<CharacterVoiceProfile> findByCharacterId(UUID characterId) {
    return mapper.findByCharacterId(characterId).stream().map(rowMapper::toDomain).toList();
  }

  @Override
  public int nextVersionNumber(UUID characterId) {
    return mapper.maxVoiceProfileVersion(characterId) + 1;
  }

  @Override
  public CharacterVoiceProfile save(CharacterVoiceProfile value) {
    CharacterVoiceProfileRow row =
        rowMapper.row(value, CharacterMyBatisRowMapper.InstantPair.now());
    if (value.getId() == null) {
      row.setId(null);
      row.setRowVersion(0);
      row.setCreatedAt(Instant.now());
      row.setUpdatedAt(row.getCreatedAt());
      UUID id = mapper.insertVoiceProfile(row);
      return rowMapper.toDomain(mapper.findById(id));
    }
    CharacterVoiceProfileRow existing = mapper.findById(value.getId());
    OptimisticConcurrency.requirePresent(existing, CharacterVoiceProfile.class, value.getId());
    OptimisticConcurrency.requireVersion(
        value.getRowVersion(),
        existing.getRowVersion(),
        CharacterVoiceProfile.class,
        value.getId());
    if (mapper.updateVoiceProfile(row) != 1) {
      throw new OptimisticLockingFailureException(
          "CharacterVoiceProfile was modified concurrently");
    }
    return rowMapper.toDomain(mapper.findById(value.getId()));
  }
}
