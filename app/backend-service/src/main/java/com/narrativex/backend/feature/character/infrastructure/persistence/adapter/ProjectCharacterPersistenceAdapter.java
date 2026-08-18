package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.ProjectCharacterJpaEntity;
import com.narrativex.backend.feature.character.infrastructure.persistence.mapper.CharacterPersistenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.repository.ProjectCharacterJpaRepository;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProjectCharacterPersistenceAdapter implements ProjectCharacterRepository {
  private final ProjectCharacterJpaRepository repository;

  @Override
  public ProjectCharacter save(ProjectCharacter assignment) {
    ProjectCharacterJpaEntity entity =
        assignment.getId() == null
            ? buildJpaEntity(assignment)
            : repository
                .findById(assignment.getId())
                .map(existing -> {
                  OptimisticConcurrency.requireVersion(
                      assignment.getRowVersion(),
                      existing.getRowVersion(),
                      ProjectCharacterJpaEntity.class,
                      assignment.getId());
                  existing.apply(assignment);
                  return existing;
                })
                .orElseGet(() -> buildJpaEntity(assignment));
    return CharacterPersistenceMapper.toDomain(repository.save(entity));
  }

  private static ProjectCharacterJpaEntity buildJpaEntity(ProjectCharacter assignment) {
    return ProjectCharacterJpaEntity.builder()
        .projectId(assignment.getProjectId())
        .characterId(assignment.getCharacterId())
        .role(assignment.getRole())
        .importance(assignment.getImportance())
        .projectAliases(new ArrayList<>(assignment.getProjectAliases()))
        .storyMetadata(assignment.getStoryMetadata())
        .groups(new ArrayList<>(assignment.getGroups()))
        .pinnedCharacterVersionId(assignment.getPinnedCharacterVersionId())
        .status(assignment.getStatus())
        .build();
  }
}
