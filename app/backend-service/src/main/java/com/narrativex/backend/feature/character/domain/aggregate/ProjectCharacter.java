package com.narrativex.backend.feature.character.domain.aggregate;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.character.domain.exception.InvalidProjectCharacterTransitionException;
import com.narrativex.backend.feature.common.domain.AggregateRoot;
import java.util.List;
import java.util.Objects;

/** Project-scoped assignment of a reusable Character identity. */
public final class ProjectCharacter extends AggregateRoot {
  private final Long projectId;
  private final Long characterId;
  private final String role;
  private final int importance;
  private final List<String> projectAliases;
  private final String storyMetadata;
  private final List<String> groups;
  private Long pinnedCharacterVersionId;
  private ProjectCharacterStatus status;

  private ProjectCharacter(
      Long id,
      long rowVersion,
      Long projectId,
      Long characterId,
      String role,
      int importance,
      List<String> projectAliases,
      String storyMetadata,
      List<String> groups,
      Long pinnedCharacterVersionId,
      ProjectCharacterStatus status) {
    super(id, rowVersion);
    if (projectId == null || projectId <= 0)
      throw new IllegalArgumentException("projectId must be positive");
    if (characterId == null || characterId <= 0)
      throw new IllegalArgumentException("characterId must be positive");
    this.projectId = projectId;
    this.characterId = characterId;
    this.role = required(role, "role");
    if (importance < 0) throw new IllegalArgumentException("importance must not be negative");
    this.importance = importance;
    this.projectAliases = List.copyOf(projectAliases == null ? List.of() : projectAliases);
    this.storyMetadata = storyMetadata;
    this.groups = List.copyOf(groups == null ? List.of() : groups);
    this.pinnedCharacterVersionId = pinnedCharacterVersionId;
    this.status = Objects.requireNonNull(status, "status");
  }

  public static ProjectCharacter assign(
      Long projectId,
      Long characterId,
      String role,
      int importance,
      List<String> projectAliases,
      String storyMetadata,
      List<String> groups,
      Long pinnedCharacterVersionId) {
    return new ProjectCharacter(
        null,
        0L,
        projectId,
        characterId,
        role,
        importance,
        projectAliases,
        storyMetadata,
        groups,
        pinnedCharacterVersionId,
        ProjectCharacterStatus.ACTIVE);
  }

  public static ProjectCharacter rehydrate(
      Long id,
      long rowVersion,
      Long projectId,
      Long characterId,
      String role,
      int importance,
      List<String> projectAliases,
      String storyMetadata,
      List<String> groups,
      Long pinnedCharacterVersionId,
      ProjectCharacterStatus status) {
    return new ProjectCharacter(
        id,
        rowVersion,
        projectId,
        characterId,
        role,
        importance,
        projectAliases,
        storyMetadata,
        groups,
        pinnedCharacterVersionId,
        status);
  }

  public void pinVersion(CharacterVersion version) {
    Objects.requireNonNull(version, "version");
    if (status == ProjectCharacterStatus.REMOVED) {
      throw new InvalidProjectCharacterTransitionException(
          "Removed project characters cannot be modified");
    }
    if (!characterId.equals(version.getCharacterId()))
      throw new IllegalArgumentException("Pinned character version belongs to another character");
    if (version.getStatus() != CharacterVersionStatus.LOCKED) {
      throw new InvalidProjectCharacterTransitionException(
          "Only locked character versions can be pinned");
    }
    if (version.getId() == null)
      throw new IllegalArgumentException("Pinned character version must be persisted");
    pinnedCharacterVersionId = version.getId();
  }

  public void remove() {
    status = ProjectCharacterStatus.REMOVED;
  }

  public Long getProjectId() {
    return projectId;
  }

  public Long getCharacterId() {
    return characterId;
  }

  public String getRole() {
    return role;
  }

  public int getImportance() {
    return importance;
  }

  public List<String> getProjectAliases() {
    return projectAliases;
  }

  public String getStoryMetadata() {
    return storyMetadata;
  }

  public List<String> getGroups() {
    return groups;
  }

  public Long getPinnedCharacterVersionId() {
    return pinnedCharacterVersionId;
  }

  public ProjectCharacterStatus getStatus() {
    return status;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
