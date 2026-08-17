package com.narrativex.backend.modules.character.domain.aggregate;

import com.narrativex.backend.modules.character.domain.aggregate.enums.CharacterStatus;
import com.narrativex.backend.shared.domain.AggregateRoot;
import java.util.List;
import java.util.Objects;

/** Reusable identity aggregate owned by a user/workspace, never duplicated per project. */
public final class Character extends AggregateRoot {

    private final String ownerId;
    private final String workspaceId;
    private final String canonicalName;
    private final List<String> aliases;
    private CharacterStatus status;

    private Character(Long id, long rowVersion, String ownerId, String workspaceId, String canonicalName,
                      List<String> aliases, CharacterStatus status) {
        super(id, rowVersion);
        this.ownerId = required(ownerId, "ownerId");
        this.workspaceId = optional(workspaceId);
        this.canonicalName = required(canonicalName, "canonicalName");
        this.aliases = List.copyOf(aliases == null ? List.of() : aliases);
        this.status = Objects.requireNonNull(status, "status");
    }

    public static Character create(String ownerId, String workspaceId, String canonicalName,
                                   List<String> aliases) {
        return new Character(null, 0L, ownerId, workspaceId, canonicalName, aliases, CharacterStatus.ACTIVE);
    }

    public static Character rehydrate(Long id, long rowVersion, String ownerId, String workspaceId,
                                      String canonicalName, List<String> aliases, CharacterStatus status) {
        return new Character(id, rowVersion, ownerId, workspaceId, canonicalName, aliases, status);
    }

    public CharacterVersion createVersion(int versionNumber, String bible, String visualPrompt,
                                          Long masterAssetId, List<Long> referenceAssetIds) {
        if (getId() == null) {
            throw new IllegalStateException("Character must be persisted before creating a version");
        }
        if (status == CharacterStatus.ARCHIVED) {
            throw new IllegalStateException("Archived characters cannot receive new versions");
        }
        return CharacterVersion.create(getId(), versionNumber, bible, visualPrompt, masterAssetId,
            referenceAssetIds);
    }

    public void archive() {
        status = CharacterStatus.ARCHIVED;
    }

    public String getOwnerId() { return ownerId; }
    public String getWorkspaceId() { return workspaceId; }
    public String getCanonicalName() { return canonicalName; }
    public List<String> getAliases() { return aliases; }
    public CharacterStatus getStatus() { return status; }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
