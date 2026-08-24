package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterRow;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisProjectCharacterPersistenceAdapter implements ProjectCharacterRepository {
  private final CharacterMapper mapper;
  private final CharacterMyBatisRowMapper rowMapper;

  @Override
  public Optional<ProjectCharacter> findByProjectAndCharacterForUpdate(
      UUID projectId, UUID characterId) {
    return Optional.ofNullable(
            mapper.findProjectCharacterByProjectAndCharacterForUpdate(projectId, characterId))
        .map(rowMapper::toDomain);
  }

  @Override
  public ProjectCharacter save(ProjectCharacter value) {
    ProjectCharacterRow row = rowMapper.row(value, CharacterMyBatisRowMapper.InstantPair.now());
    if (value.getId() == null) {
      row.setId(null);
      row.setRowVersion(0);
      UUID id = mapper.insertProjectCharacter(row);
      return rowMapper.toDomain(mapper.findProjectCharacter(id));
    }
    ProjectCharacterRow existing = mapper.findProjectCharacter(value.getId());
    if (existing == null) {
      row.setId(null);
      row.setRowVersion(0);
      UUID id = mapper.insertProjectCharacter(row);
      return rowMapper.toDomain(mapper.findProjectCharacter(id));
    }
    OptimisticConcurrency.requireVersion(
        value.getRowVersion(), existing.getRowVersion(), ProjectCharacter.class, value.getId());
    if (mapper.updateProjectCharacter(row) != 1)
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Project character was modified concurrently");
    return rowMapper.toDomain(mapper.findProjectCharacter(value.getId()));
  }
}
