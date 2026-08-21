package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterReadRepository;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterReadMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterReadRow;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Repository
@RequiredArgsConstructor
public class ProjectCharacterReadPersistenceAdapter implements ProjectCharacterReadRepository {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

  private final ProjectCharacterReadMapper mapper;
  private final ObjectMapper objectMapper;

  @Override
  public boolean projectOwnedBy(Long projectId, String ownerId) {
    return mapper.projectOwnedBy(projectId, ownerId);
  }

  @Override
  public CursorPage<ProjectCharacterReadModel> findByProject(
      Long projectId, String ownerId, String cursor, int limit) {
    if (limit < 1 || limit > 100) {
      throw new DomainValidationException("limit must be between 1 and 100");
    }

    CursorKey key = CursorCodec.decode(cursor);
    int fetchLimit = limit + 1;
    List<ProjectCharacterReadRow> rows =
        key == null
            ? mapper.findFirstPage(projectId, ownerId, fetchLimit)
            : mapper.findAfter(projectId, ownerId, key.updatedAt(), key.id(), fetchLimit);

    boolean hasNext = rows.size() > limit;
    List<ProjectCharacterReadRow> pageRows = hasNext ? rows.subList(0, limit) : rows;
    List<ProjectCharacterReadModel> content = pageRows.stream().map(this::map).toList();
    String nextCursor =
        hasNext && !pageRows.isEmpty()
            ? CursorCodec.encode(
                pageRows.get(pageRows.size() - 1).getUpdatedAt(),
                pageRows.get(pageRows.size() - 1).getAssignmentId())
            : null;

    return new CursorPage<>(content, nextCursor, limit, hasNext);
  }

  @Override
  public Optional<ProjectCharacterReadModel> findDetail(
      Long projectId, Long characterId, String ownerId) {
    return Optional.ofNullable(mapper.findDetail(projectId, characterId, ownerId)).map(this::map);
  }

  private ProjectCharacterReadModel map(ProjectCharacterReadRow row) {
    ProjectCharacterReadModel.Version version =
        row.getPinnedCharacterVersionId() == null
            ? null
            : new ProjectCharacterReadModel.Version(
                row.getVersionNumber(),
                row.getVersionStatus(),
                row.getBible(),
                row.getVisualPrompt(),
                row.getMasterAssetId());

    boolean hasAppearance =
        row.getAgeState() != null
            || row.getHairstyle() != null
            || row.getInjury() != null
            || row.getWardrobeContext() != null
            || row.getAppearancePrompt() != null;
    ProjectCharacterReadModel.Appearance appearance =
        hasAppearance
            ? new ProjectCharacterReadModel.Appearance(
                row.getAgeState(),
                row.getHairstyle(),
                row.getInjury(),
                row.getWardrobeContext(),
                row.getAppearancePrompt())
            : null;

    return new ProjectCharacterReadModel(
        row.getAssignmentId(),
        row.getCharacterId(),
        row.getProjectId(),
        row.getWorkspaceId(),
        row.getCanonicalName(),
        parseStringList(row.getAliasesJson()),
        parseStringList(row.getProjectAliasesJson()),
        row.getRole(),
        row.getImportance(),
        parseStringList(row.getGroupsJson()),
        row.getPinnedCharacterVersionId(),
        row.getStatus(),
        row.getSceneCount(),
        row.getRowVersion(),
        row.getCreatedAt(),
        row.getUpdatedAt(),
        version,
        appearance);
  }

  private List<String> parseStringList(String json) {
    if (json == null || json.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(json, STRING_LIST);
    } catch (JacksonException exception) {
      throw new IllegalStateException("Invalid character JSON projection", exception);
    }
  }
}
