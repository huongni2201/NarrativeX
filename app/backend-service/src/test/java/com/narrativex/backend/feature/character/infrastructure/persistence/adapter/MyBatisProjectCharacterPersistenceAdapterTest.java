package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterMyBatisRowMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterRow;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MyBatisProjectCharacterPersistenceAdapterTest {
  @Mock private CharacterMapper mapper;
  @Mock private CharacterMyBatisRowMapper rowMapper;

  @Test
  void concurrentInsertLoserReturnsTheWinningAssignment() {
    UUID projectId = UUID.randomUUID();
    UUID characterId = UUID.randomUUID();
    UUID winningAssignmentId = UUID.randomUUID();
    ProjectCharacter candidate =
        ProjectCharacter.assign(
            projectId, characterId, "SUPPORTING", 0, List.of(), null, List.of(), null);
    ProjectCharacterRow insertRow = new ProjectCharacterRow();
    ProjectCharacterRow winnerRow = new ProjectCharacterRow();
    ProjectCharacter winner =
        ProjectCharacter.rehydrate(
            winningAssignmentId,
            0L,
            projectId,
            characterId,
            "SUPPORTING",
            0,
            List.of(),
            null,
            List.of(),
            null,
            ProjectCharacterStatus.ACTIVE);

    when(rowMapper.row(
            any(ProjectCharacter.class), any(CharacterMyBatisRowMapper.InstantPair.class)))
        .thenReturn(insertRow);
    when(mapper.insertProjectCharacter(insertRow)).thenReturn(null);
    when(mapper.findProjectCharacterByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(winnerRow);
    when(rowMapper.toDomain(winnerRow)).thenReturn(winner);

    ProjectCharacter result =
        new MyBatisProjectCharacterPersistenceAdapter(mapper, rowMapper).save(candidate);

    assertSame(winner, result);
    verify(mapper).insertProjectCharacter(insertRow);
    verify(mapper).findProjectCharacterByProjectAndCharacterForUpdate(projectId, characterId);
  }
}
