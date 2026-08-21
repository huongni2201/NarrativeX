package com.narrativex.backend.feature.character.application.query;

import java.time.Instant;
import java.util.List;

public record ProjectCharacterReadModel(
    Long assignmentId,
    Long characterId,
    Long projectId,
    String workspaceId,
    String canonicalName,
    List<String> aliases,
    List<String> projectAliases,
    String role,
    int importance,
    List<String> groups,
    Long pinnedCharacterVersionId,
    String status,
    int sceneCount,
    long rowVersion,
    Instant createdAt,
    Instant updatedAt,
    Version version,
    Appearance appearance) {

  public record Version(
      Integer versionNumber,
      String status,
      String bible,
      String visualPrompt,
      Long masterAssetId) {}

  public record Appearance(
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String appearancePrompt) {}
}
