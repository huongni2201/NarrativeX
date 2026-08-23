package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProjectCharacterSummaryResponse(
    UUID id,
    UUID assignmentId,
    UUID projectId,
    String workspaceId,
    String canonicalName,
    List<String> aliases,
    List<String> projectAliases,
    String role,
    int importance,
    List<String> groups,
    UUID pinnedCharacterVersionId,
    String status,
    int sceneCount,
    long rowVersion,
    Instant createdAt,
    Instant updatedAt) {

  public static ProjectCharacterSummaryResponse from(ProjectCharacterReadModel model) {
    return new ProjectCharacterSummaryResponse(
        model.characterId(),
        model.assignmentId(),
        model.projectId(),
        model.workspaceId(),
        model.canonicalName(),
        model.aliases(),
        model.projectAliases(),
        model.role(),
        model.importance(),
        model.groups(),
        model.pinnedCharacterVersionId(),
        model.status(),
        model.sceneCount(),
        model.rowVersion(),
        model.createdAt(),
        model.updatedAt());
  }
}
