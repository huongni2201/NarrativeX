package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.ProjectJpaEntity;
import com.narrativex.backend.feature.project.infrastructure.persistence.mapper.ProjectPersistenceMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.repository.ProjectJpaRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProjectPersistenceAdapter implements ProjectRepository {
  private final ProjectJpaRepository repository;

  @Override
  public CursorPage<Project> findActiveByOwnerId(String ownerId, String cursor, int limit) {
    CursorKey cursorKey = CursorCodec.decode(cursor);
    PageRequest fetchLimit = PageRequest.of(0, limit + 1);
    List<ProjectJpaEntity> entities =
        cursorKey == null
            ? repository.findActiveFirstPage(ownerId, fetchLimit)
            : repository.findActiveAfter(
                ownerId, cursorKey.updatedAt(), cursorKey.id(), fetchLimit);

    boolean hasNext = entities.size() > limit;
    List<ProjectJpaEntity> visibleEntities = entities.subList(0, Math.min(limit, entities.size()));
    String nextCursor =
        hasNext && !visibleEntities.isEmpty() ? cursorFor(visibleEntities.getLast()) : null;
    List<Project> content =
        visibleEntities.stream().map(ProjectPersistenceMapper::toDomain).toList();

    return new CursorPage<>(content, nextCursor, limit, hasNext);
  }

  @Override
  public Optional<Project> findOwnedById(Long projectId, String ownerId) {
    return repository
        .findByIdAndOwnerIdAndArchivedAtIsNull(projectId, ownerId)
        .map(ProjectPersistenceMapper::toDomain);
  }

  @Override
  public Optional<Project> findOwnedByIdForUpdate(Long projectId, String ownerId) {
    return repository
        .findOwnedByIdForUpdate(projectId, ownerId)
        .map(ProjectPersistenceMapper::toDomain);
  }

  @Override
  public Project save(Project project) {
    ProjectJpaEntity entity =
        project.getId() == null
            ? buildJpaEntity(project)
            : repository
                .findById(project.getId())
                .map(existing -> {
                  OptimisticConcurrency.requireVersion(
                      project.getRowVersion(),
                      existing.getRowVersion(),
                      ProjectJpaEntity.class,
                      project.getId());
                  existing.apply(project);
                  return existing;
                })
                .orElseGet(() -> buildJpaEntity(project));
    return ProjectPersistenceMapper.toDomain(repository.save(entity));
  }

  private static ProjectJpaEntity buildJpaEntity(Project project) {
    return ProjectJpaEntity.builder()
        .name(project.getName())
        .ownerId(project.getOwnerId())
        .status(project.getStatus())
        .sourceLanguage(project.getSourceLanguage())
        .narrationLanguage(project.getNarrationLanguage())
        .metadataLanguage(project.getMetadataLanguage())
        .imageAspectRatio(project.getImageAspectRatio())
        .imageQualityTier(project.getImageQualityTier())
        .archivedAt(project.getArchivedAt())
        .build();
  }

  private static String cursorFor(ProjectJpaEntity entity) {
    return CursorCodec.encode(entity.getUpdatedAt(), entity.getId());
  }
}
