package com.narrativex.backend.feature.character.application.query;

import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProjectCharacterReadModel(
    UUID assignmentId,
    UUID characterId,
    UUID projectId,
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
    Version version,
    Appearance appearance) {

  public record Version(
      UUID id,
      Integer versionNumber,
      String status,
      String bible,
      String visualPrompt,
      String referencePolicy,
      CharacterVisualProfile visualProfile,
      UUID basedOnVersionId) {
    public Version(
        UUID id, Integer versionNumber, String status, String bible, String visualPrompt) {
      this(id, versionNumber, status, bible, visualPrompt, "LEGACY_IDENTITY_V1", null, null);
    }
  }

  public record Appearance(
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String appearancePrompt) {}
}
