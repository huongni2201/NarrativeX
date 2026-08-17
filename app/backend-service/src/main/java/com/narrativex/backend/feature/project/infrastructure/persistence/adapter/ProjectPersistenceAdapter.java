package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

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
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
public class ProjectPersistenceAdapter implements ProjectRepository {
  private final ProjectJpaRepository repository;

  public ProjectPersistenceAdapter(ProjectJpaRepository repository) {
    this.repository = repository;
  }

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
            ? new ProjectJpaEntity(project)
            : repository.findById(project.getId()).orElseGet(() -> new ProjectJpaEntity(project));
    entity.apply(project);
    return ProjectPersistenceMapper.toDomain(repository.save(entity));
  }

  private static String cursorFor(ProjectJpaEntity entity) {
    return CursorCodec.encode(entity.getUpdatedAt(), entity.getId());
  }
}
