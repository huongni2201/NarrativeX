package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import com.narrativex.backend.feature.project.infrastructure.persistence.mapper.ProjectPersistenceMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.repository.StoryVersionJpaRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class StoryVersionPersistenceAdapter implements StoryVersionRepository {
  private final StoryVersionJpaRepository repository;

  public StoryVersionPersistenceAdapter(StoryVersionJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  public int findMaxVersionNumberByProjectId(Long projectId) {
    return repository.findMaxVersionNumberByProjectId(projectId);
  }

  @Override
  public Optional<StoryVersion> findByIdAndProjectId(Long storyVersionId, Long projectId) {
    return repository
        .findByIdAndProjectId(storyVersionId, projectId)
        .map(ProjectPersistenceMapper::toDomain);
  }

  @Override
  public Optional<StoryVersion> findActiveByProjectId(Long projectId) {
    return repository
        .findFirstByProjectIdAndStatus(projectId, StoryVersionStatus.ACTIVE)
        .map(ProjectPersistenceMapper::toDomain);
  }

  @Override
  public StoryVersion save(StoryVersion storyVersion) {
    return ProjectPersistenceMapper.toDomain(repository.save(toJpaEntity(storyVersion)));
  }

  @Override
  public StoryVersion saveAndFlush(StoryVersion storyVersion) {
    return ProjectPersistenceMapper.toDomain(repository.saveAndFlush(toJpaEntity(storyVersion)));
  }

  private StoryVersionJpaEntity toJpaEntity(StoryVersion storyVersion) {
    StoryVersionJpaEntity entity =
        storyVersion.getId() == null
            ? new StoryVersionJpaEntity(storyVersion)
            : repository
                .findById(storyVersion.getId())
                .orElseGet(() -> new StoryVersionJpaEntity(storyVersion));
    entity.apply(storyVersion);
    return entity;
  }
}
