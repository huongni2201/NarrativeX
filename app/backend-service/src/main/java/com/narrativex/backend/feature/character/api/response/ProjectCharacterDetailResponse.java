package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProjectCharacterDetailResponse(
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
    Instant updatedAt,
    VersionResponse version,
    AppearanceResponse appearance) {

  public static ProjectCharacterDetailResponse from(ProjectCharacterReadModel model) {
    return new ProjectCharacterDetailResponse(
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
        model.updatedAt(),
        VersionResponse.from(model.version()),
        AppearanceResponse.from(model.appearance()));
  }

  public record VersionResponse(
      UUID id, Integer versionNumber, String status, String bible, String visualPrompt) {
    static VersionResponse from(ProjectCharacterReadModel.Version version) {
      return version == null
          ? null
          : new VersionResponse(
              version.id(),
              version.versionNumber(),
              version.status(),
              version.bible(),
              version.visualPrompt());
    }
  }

  public record AppearanceResponse(
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String appearancePrompt) {
    static AppearanceResponse from(ProjectCharacterReadModel.Appearance appearance) {
      return appearance == null
          ? null
          : new AppearanceResponse(
              appearance.ageState(),
              appearance.hairstyle(),
              appearance.injury(),
              appearance.wardrobeContext(),
              appearance.appearancePrompt());
    }
  }
}
