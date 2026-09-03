package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.pagination.UuidCursorKey;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisProjectRepository implements ProjectRepository {
  private final ProjectMapper mapper;

  @Override
  @Transactional(readOnly = true)
  public CursorPage<Project> findActiveByOwnerId(String ownerId, String cursor, int limit) {
    UuidCursorKey cursorKey = CursorCodec.decodeUuid(cursor);
    int fetchLimit = limit + 1;
    List<ProjectRow> rows =
        cursorKey == null
            ? mapper.findActiveFirstPage(ownerId, fetchLimit)
            : mapper.findActiveAfter(ownerId, cursorKey.updatedAt(), cursorKey.id(), fetchLimit);

    boolean hasNext = rows.size() > limit;
    List<ProjectRow> visibleRows = rows.subList(0, Math.min(limit, rows.size()));
    String nextCursor = hasNext && !visibleRows.isEmpty() ? cursorFor(visibleRows.getLast()) : null;
    List<Project> content = visibleRows.stream().map(ProjectRow::toDomain).toList();

    return new CursorPage<>(content, nextCursor, limit, hasNext);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Project> findOwnedById(UUID projectId, String ownerId) {
    return Optional.ofNullable(mapper.findOwnedById(projectId, ownerId)).map(ProjectRow::toDomain);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Project> findOwnedByIdForUpdate(UUID projectId, String ownerId) {
    return Optional.ofNullable(mapper.findOwnedByIdForUpdate(projectId, ownerId))
        .map(ProjectRow::toDomain);
  }

  @Override
  @Transactional
  public Project save(Project project) {
    if (project.getId() == null) {
      UUID insertedId = mapper.insert(toInsertRow(project));
      if (insertedId == null) {
        throw new IllegalStateException("Inserted project did not return an id");
      }
      return findById(insertedId)
          .orElseThrow(() -> new IllegalStateException("Inserted project disappeared"));
    }

    if (mapper.findById(project.getId()) == null) {
      throw new ResourceNotFoundException("Project was not found");
    }
    if (mapper.update(toUpdateRow(project)) != 1) {
      throw new OptimisticLockingFailureException("Project was modified concurrently");
    }
    return findById(project.getId())
        .orElseThrow(
            () -> new OptimisticLockingFailureException("Project was modified concurrently"));
  }

  private Optional<Project> findById(UUID projectId) {
    return Optional.ofNullable(mapper.findById(projectId)).map(ProjectRow::toDomain);
  }

  private static ProjectRow toInsertRow(Project project) {
    Instant now = Instant.now();
    return ProjectRow.builder()
        .rowVersion(0L)
        .createdAt(now)
        .updatedAt(now)
        .name(project.getName())
        .description(project.getDescription())
        .coverImageUrl(project.getCoverImageUrl())
        .ownerId(project.getOwnerId())
        .status(project.getStatus())
        .sourceLanguage(project.getSourceLanguage())
        .narrationLanguage(project.getNarrationLanguage())
        .metadataLanguage(project.getMetadataLanguage())
        .imageAspectRatio(project.getImageAspectRatio())
        .archivedAt(project.getArchivedAt())
        .build();
  }

  private static ProjectRow toUpdateRow(Project project) {
    return ProjectRow.builder()
        .id(project.getId())
        .rowVersion(project.getRowVersion())
        .updatedAt(Instant.now())
        .name(project.getName())
        .description(project.getDescription())
        .coverImageUrl(project.getCoverImageUrl())
        .ownerId(project.getOwnerId())
        .status(project.getStatus())
        .sourceLanguage(project.getSourceLanguage())
        .narrationLanguage(project.getNarrationLanguage())
        .metadataLanguage(project.getMetadataLanguage())
        .imageAspectRatio(project.getImageAspectRatio())
        .archivedAt(project.getArchivedAt())
        .build();
  }

  private static String cursorFor(ProjectRow row) {
    return CursorCodec.encode(row.getUpdatedAt(), row.getId());
  }
}
