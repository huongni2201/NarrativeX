package com.narrativex.backend.modules.character.domain.model;

import com.narrativex.backend.shared.domain.DomainEntity;
import java.util.Objects;

/** Versioned outfit definition, separate from canonical Character identity. */
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
        this.characterId = Objects.requireNonNull(characterId, "characterId");
        this.versionNumber = versionNumber;
        this.name = required(name, "name");
        this.description = description;
        this.prompt = prompt;
        this.status = Objects.requireNonNull(status, "status");
    }

    public static OutfitVersion create(Long characterId, int versionNumber, String name, String description,
                                       String prompt) {
        return new OutfitVersion(null, 0L, characterId, versionNumber, name, description, prompt,
            OutfitVersionStatus.DRAFT);
    }

    public static OutfitVersion rehydrate(Long id, long rowVersion, Long characterId, int versionNumber,
                                          String name, String description, String prompt,
                                          OutfitVersionStatus status) {
        return new OutfitVersion(id, rowVersion, characterId, versionNumber, name, description, prompt, status);
    }

    public void activate() {
        status = OutfitVersionStatus.ACTIVE;
    }

    public Long getCharacterId() { return characterId; }
    public int getVersionNumber() { return versionNumber; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getPrompt() { return prompt; }
    public OutfitVersionStatus getStatus() { return status; }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
