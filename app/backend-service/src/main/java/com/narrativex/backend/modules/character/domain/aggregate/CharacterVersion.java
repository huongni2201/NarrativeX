package com.narrativex.backend.modules.character.domain.aggregate;

import com.narrativex.backend.modules.character.domain.aggregate.enums.CharacterVersionStatus;
import com.narrativex.backend.shared.domain.DomainEntity;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Immutable-after-lock identity/Bible/reference snapshot. */
public final class CharacterVersion extends DomainEntity {

    private final Long characterId;
    private final int versionNumber;
    private final String bible;
    private final String visualPrompt;
    private final Long masterAssetId;
    private final List<Long> referenceAssetIds;
    private CharacterVersionStatus status;
    private Instant lockedAt;
    private String lockedBy;

    private CharacterVersion(Long id, long rowVersion, Long characterId, int versionNumber, String bible,
                             String visualPrompt, Long masterAssetId, List<Long> referenceAssetIds,
                             CharacterVersionStatus status, Instant lockedAt, String lockedBy) {
        super(id, rowVersion);
        if (characterId == null || characterId <= 0) {
            throw new IllegalArgumentException("characterId must be positive");
        }
        if (versionNumber <= 0) {
            throw new IllegalArgumentException("versionNumber must be positive");
        }
        this.characterId = characterId;
        this.versionNumber = versionNumber;
        this.bible = required(bible, "bible");
        this.visualPrompt = required(visualPrompt, "visualPrompt");
        this.masterAssetId = masterAssetId;
        this.referenceAssetIds = List.copyOf(referenceAssetIds == null ? List.of() : referenceAssetIds);
        this.status = Objects.requireNonNull(status, "status");
        this.lockedAt = lockedAt;
        this.lockedBy = lockedBy;
    }

    public static CharacterVersion create(Long characterId, int versionNumber, String bible, String visualPrompt,
                                          Long masterAssetId, List<Long> referenceAssetIds) {
        return new CharacterVersion(null, 0L, characterId, versionNumber, bible, visualPrompt, masterAssetId,
            referenceAssetIds, CharacterVersionStatus.DRAFT, null, null);
    }

    public static CharacterVersion rehydrate(Long id, long rowVersion, Long characterId, int versionNumber,
                                             String bible, String visualPrompt, Long masterAssetId,
                                             List<Long> referenceAssetIds, CharacterVersionStatus status,
                                             Instant lockedAt, String lockedBy) {
        return new CharacterVersion(id, rowVersion, characterId, versionNumber, bible, visualPrompt,
            masterAssetId, referenceAssetIds, status, lockedAt, lockedBy);
    }

    public void submitForReview() {
        if (status != CharacterVersionStatus.DRAFT && status != CharacterVersionStatus.GENERATING) {
            throw new IllegalStateException("Only draft or generating versions can enter review");
        }
        status = CharacterVersionStatus.REVIEW;
    }

    public void lock(String actorId) {
        if (status != CharacterVersionStatus.REVIEW) {
            throw new IllegalStateException("Only reviewed character versions can be locked");
        }
        status = CharacterVersionStatus.LOCKED;
        lockedAt = Instant.now();
        lockedBy = required(actorId, "actorId");
    }

    public Long getCharacterId() { return characterId; }
    public int getVersionNumber() { return versionNumber; }
    public String getBible() { return bible; }
    public String getVisualPrompt() { return visualPrompt; }
    public Long getMasterAssetId() { return masterAssetId; }
    public List<Long> getReferenceAssetIds() { return referenceAssetIds; }
    public CharacterVersionStatus getStatus() { return status; }
    public Instant getLockedAt() { return lockedAt; }
    public String getLockedBy() { return lockedBy; }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
