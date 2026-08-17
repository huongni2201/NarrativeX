package com.narrativex.backend.modules.character.domain.model;

import com.narrativex.backend.shared.domain.DomainEntity;
import java.util.Objects;

/** Story/timeline visual state; changing it does not create a new Character identity. */
public final class CharacterAppearance extends DomainEntity {

    private final Long characterId;
    private final Long projectId;
    private final String timelineKey;
    private final String ageState;
    private final String hairstyle;
    private final String injury;
    private final String wardrobeContext;
    private final String appearancePrompt;
    private final Long outfitVersionId;

    private CharacterAppearance(Long id, long rowVersion, Long characterId, Long projectId, String timelineKey,
                                String ageState, String hairstyle, String injury, String wardrobeContext,
                                String appearancePrompt, Long outfitVersionId) {
        super(id, rowVersion);
        this.characterId = Objects.requireNonNull(characterId, "characterId");
        this.projectId = projectId;
        this.timelineKey = required(timelineKey, "timelineKey");
        this.ageState = ageState;
        this.hairstyle = hairstyle;
        this.injury = injury;
        this.wardrobeContext = wardrobeContext;
        this.appearancePrompt = appearancePrompt;
        this.outfitVersionId = outfitVersionId;
    }

    public static CharacterAppearance create(Long characterId, Long projectId, String timelineKey,
                                             String ageState, String hairstyle, String injury,
                                             String wardrobeContext, String appearancePrompt,
                                             OutfitVersion outfitVersion) {
        Objects.requireNonNull(characterId, "characterId");
        Long outfitVersionId = outfitVersion == null ? null : outfitVersion.getId();
        if (outfitVersion != null && !characterId.equals(outfitVersion.getCharacterId())) {
            throw new IllegalArgumentException("outfitVersion must belong to characterId");
        }
        if (outfitVersion != null && outfitVersionId == null) {
            throw new IllegalArgumentException("outfitVersion must be persisted");
        }
        return new CharacterAppearance(null, 0L, characterId, projectId, timelineKey, ageState, hairstyle,
            injury, wardrobeContext, appearancePrompt, outfitVersionId);
    }

    public static CharacterAppearance rehydrate(Long id, long rowVersion, Long characterId, Long projectId,
                                                String timelineKey, String ageState, String hairstyle,
                                                String injury, String wardrobeContext, String appearancePrompt,
                                                Long outfitVersionId) {
        return new CharacterAppearance(id, rowVersion, characterId, projectId, timelineKey, ageState, hairstyle,
            injury, wardrobeContext, appearancePrompt, outfitVersionId);
    }

    public Long getCharacterId() { return characterId; }
    public Long getProjectId() { return projectId; }
    public String getTimelineKey() { return timelineKey; }
    public String getAgeState() { return ageState; }
    public String getHairstyle() { return hairstyle; }
    public String getInjury() { return injury; }
    public String getWardrobeContext() { return wardrobeContext; }
    public String getAppearancePrompt() { return appearancePrompt; }
    public Long getOutfitVersionId() { return outfitVersionId; }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
