package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import com.narrativex.backend.feature.project.infrastructure.persistence.mapper.ProjectPersistenceMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.repository.StoryVersionJpaRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StoryVersionPersistenceAdapter implements StoryVersionRepository {
  private final StoryVersionJpaRepository repository;

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
  public Optional<StoryVersion> findLatestByProjectId(Long projectId) {
    return repository
        .findFirstByProjectIdOrderByVersionNumberDesc(projectId)
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
    return storyVersion.getId() == null
        ? buildJpaEntity(storyVersion)
        : repository
            .findById(storyVersion.getId())
            .map(existing -> {
              OptimisticConcurrency.requireVersion(
                  storyVersion.getRowVersion(),
                  existing.getRowVersion(),
                  StoryVersionJpaEntity.class,
                  storyVersion.getId());
              existing.apply(storyVersion);
              return existing;
            })
            .orElseGet(() -> buildJpaEntity(storyVersion));
  }

  private static StoryVersionJpaEntity buildJpaEntity(StoryVersion storyVersion) {
    return StoryVersionJpaEntity.builder()
        .projectId(storyVersion.getProjectId())
        .versionNumber(storyVersion.getVersionNumber())
        .content(storyVersion.getContent())
        .sourceLanguage(storyVersion.getSourceLanguage())
        .status(storyVersion.getStatus())
        .moderationDecision(storyVersion.getModerationDecision())
        .build();
  }
}
