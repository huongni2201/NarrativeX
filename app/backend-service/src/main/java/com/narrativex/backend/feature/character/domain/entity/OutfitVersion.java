package com.narrativex.backend.feature.character.domain.entity;

import com.narrativex.backend.feature.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.util.Objects;

/** Versioned outfit definition owned by Character. */
public final class OutfitVersion extends DomainEntity {
    private final Long characterId;
    private final int versionNumber;
    private final String name;
    private final String description;
    private final String prompt;
    private OutfitVersionStatus status;

    private OutfitVersion(Long id, long rowVersion, Long characterId, int versionNumber, String name,
                          String description, String prompt, OutfitVersionStatus status) {
        super(id, rowVersion);
        if (characterId == null || characterId <= 0) throw new IllegalArgumentException("characterId must be positive");
        if (versionNumber <= 0) throw new IllegalArgumentException("versionNumber must be positive");
        this.characterId = characterId;
        this.versionNumber = versionNumber;
        this.name = required(name, "name");
        this.description = description;
        this.prompt = prompt;
        this.status = Objects.requireNonNull(status, "status");
    }

    public static OutfitVersion create(Long characterId, int versionNumber, String name, String description, String prompt) {
        return new OutfitVersion(null, 0L, characterId, versionNumber, name, description, prompt, OutfitVersionStatus.DRAFT);
    }

    public static OutfitVersion rehydrate(Long id, long rowVersion, Long characterId, int versionNumber,
                                          String name, String description, String prompt, OutfitVersionStatus status) {
        return new OutfitVersion(id, rowVersion, characterId, versionNumber, name, description, prompt, status);
    }

    public void activate() {
        if (status != OutfitVersionStatus.DRAFT) throw new IllegalStateException("Only draft outfit versions can be activated");
        status = OutfitVersionStatus.ACTIVE;
    }

    public Long getCharacterId() { return characterId; }
    public int getVersionNumber() { return versionNumber; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getPrompt() { return prompt; }
    public OutfitVersionStatus getStatus() { return status; }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " must not be blank");
        return value;
    }
}
