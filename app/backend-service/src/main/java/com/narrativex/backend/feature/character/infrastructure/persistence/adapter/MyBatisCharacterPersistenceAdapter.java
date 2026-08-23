package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterRow;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCharacterPersistenceAdapter implements CharacterRepository {
  private final CharacterMapper mapper;
  private final CharacterMyBatisRowMapper rowMapper;

  @Override
  public CursorPage<Character> findActiveByOwnerId(String ownerId, String cursor, int limit) {
    CursorKey key = CursorCodec.decode(cursor);
    List<CharacterRow> rows =
        key == null
            ? mapper.findActiveFirstPage(ownerId, limit + 1)
            : mapper.findActiveAfter(ownerId, key.updatedAt(), key.id(), limit + 1);
    boolean hasNext = rows.size() > limit;
    List<CharacterRow> visible = rows.subList(0, Math.min(limit, rows.size()));
    String next =
        hasNext && !visible.isEmpty()
            ? CursorCodec.encode(visible.getLast().getUpdatedAt(), visible.getLast().getId())
            : null;
    return new CursorPage<>(
        visible.stream().map(rowMapper::toDomain).toList(), next, limit, hasNext);
  }

  @Override
  public long countActiveByOwnerId(String ownerId) {
    return mapper.countActive(ownerId, CharacterStatus.ACTIVE.name());
  }

  @Override
  public Optional<Character> findOwnedById(Long id, String ownerId) {
    return Optional.ofNullable(mapper.findOwned(id, ownerId, CharacterStatus.ARCHIVED.name()))
        .map(rowMapper::toDomain);
  }

  @Override
  public Optional<Character> findOwnedByIdForUpdate(Long id, String ownerId) {
    return Optional.ofNullable(
            mapper.findOwnedForUpdate(id, ownerId, CharacterStatus.ARCHIVED.name()))
        .map(rowMapper::toDomain);
  }

  @Override
  public Character save(Character value) {
    CharacterRow row = rowMapper.row(value, CharacterMyBatisRowMapper.InstantPair.now());
    if (value.getId() == null) {
      row.setId(null);
      row.setRowVersion(0);
      row.setCreatedAt(java.time.Instant.now());
      row.setUpdatedAt(row.getCreatedAt());
      Long id = mapper.insertCharacter(row);
      row.setId(id);
      return rowMapper.toDomain(mapper.findCharacter(id));
    }
    CharacterRow existing = mapper.findCharacter(value.getId());
    if (existing == null) {
      row.setId(null);
      row.setRowVersion(0);
      Long id = mapper.insertCharacter(row);
      row.setId(id);
      return rowMapper.toDomain(mapper.findCharacter(id));
    }
    OptimisticConcurrency.requireVersion(
        value.getRowVersion(), existing.getRowVersion(), Character.class, value.getId());
    if (mapper.updateCharacter(row) != 1)
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Character was modified concurrently");
    return rowMapper.toDomain(mapper.findCharacter(value.getId()));
  }
}
