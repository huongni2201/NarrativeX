package com.narrativex.backend.modules.character.domain.aggregate;

import com.narrativex.backend.shared.domain.AggregateRoot;
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

    private ProjectCharacter(Long id, long rowVersion, Long projectId, Long characterId, String role,
                             int importance, List<String> projectAliases, String storyMetadata,
                             List<String> groups, Long pinnedCharacterVersionId, ProjectCharacterStatus status) {
        super(id, rowVersion);
        this.projectId = Objects.requireNonNull(projectId, "projectId");
        this.characterId = Objects.requireNonNull(characterId, "characterId");
        this.role = required(role, "role");
        if (importance < 0) {
            throw new IllegalArgumentException("importance must not be negative");
        }
        this.importance = importance;
        this.projectAliases = List.copyOf(projectAliases == null ? List.of() : projectAliases);
        this.storyMetadata = storyMetadata;
        this.groups = List.copyOf(groups == null ? List.of() : groups);
        this.pinnedCharacterVersionId = pinnedCharacterVersionId;
        this.status = Objects.requireNonNull(status, "status");
    }

    public static ProjectCharacter assign(Long projectId, Long characterId, String role, int importance,
                                          List<String> projectAliases, String storyMetadata, List<String> groups,
                                          Long pinnedCharacterVersionId) {
        return new ProjectCharacter(null, 0L, projectId, characterId, role, importance, projectAliases,
            storyMetadata, groups, pinnedCharacterVersionId, ProjectCharacterStatus.ACTIVE);
    }

    public static ProjectCharacter rehydrate(Long id, long rowVersion, Long projectId, Long characterId,
                                             String role, int importance, List<String> projectAliases,
                                             String storyMetadata, List<String> groups,
                                             Long pinnedCharacterVersionId, ProjectCharacterStatus status) {
        return new ProjectCharacter(id, rowVersion, projectId, characterId, role, importance, projectAliases,
            storyMetadata, groups, pinnedCharacterVersionId, status);
    }

    public void pinVersion(CharacterVersion version) {
        if (!characterId.equals(version.getCharacterId())) {
            throw new IllegalArgumentException("Pinned character version belongs to another character");
        }
        if (version.getStatus() != CharacterVersionStatus.LOCKED) {
            throw new IllegalStateException("Only locked character versions can be pinned");
        }
        pinnedCharacterVersionId = version.getId();
    }

    public void remove() {
        status = ProjectCharacterStatus.REMOVED;
    }

    public Long getProjectId() { return projectId; }
    public Long getCharacterId() { return characterId; }
    public String getRole() { return role; }
    public int getImportance() { return importance; }
    public List<String> getProjectAliases() { return projectAliases; }
    public String getStoryMetadata() { return storyMetadata; }
    public List<String> getGroups() { return groups; }
    public Long getPinnedCharacterVersionId() { return pinnedCharacterVersionId; }
    public ProjectCharacterStatus getStatus() { return status; }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
