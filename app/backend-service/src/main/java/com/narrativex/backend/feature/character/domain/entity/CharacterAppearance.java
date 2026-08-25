package com.narrativex.backend.feature.character.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.util.Objects;
import java.util.UUID;

/** Story/timeline visual state owned by a Character context. */
public final class CharacterAppearance extends DomainEntity {
  private final UUID characterId;
  private final UUID projectId;
  private final String timelineKey;
  private final String ageState;
  private final String hairstyle;
  private final String injury;
  private final String wardrobeContext;
  private final String appearancePrompt;
  private final UUID outfitVersionId;

  private CharacterAppearance(
      UUID id,
      long rowVersion,
      UUID characterId,
      UUID projectId,
      String timelineKey,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String appearancePrompt,
      UUID outfitVersionId) {
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

  public static CharacterAppearance create(
      UUID characterId,
      UUID projectId,
      String timelineKey,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String appearancePrompt,
      OutfitVersion outfitVersion) {
    UUID outfitVersionId = outfitVersion == null ? null : outfitVersion.getId();
    if (outfitVersion != null && !characterId.equals(outfitVersion.getCharacterId()))
      throw new IllegalArgumentException("outfitVersion must belong to characterId");
    if (outfitVersion != null && outfitVersionId == null)
      throw new IllegalArgumentException("outfitVersion must be persisted");
    return new CharacterAppearance(
        null,
        0L,
        characterId,
        projectId,
        timelineKey,
        ageState,
        hairstyle,
        injury,
        wardrobeContext,
        appearancePrompt,
        outfitVersionId);
  }

  public static CharacterAppearance rehydrate(
      UUID id,
      long rowVersion,
      UUID characterId,
      UUID projectId,
      String timelineKey,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String appearancePrompt,
      UUID outfitVersionId) {
    return new CharacterAppearance(
        id,
        rowVersion,
        characterId,
        projectId,
        timelineKey,
        ageState,
        hairstyle,
        injury,
        wardrobeContext,
        appearancePrompt,
        outfitVersionId);
  }

  public UUID getCharacterId() {
    return characterId;
  }

  public UUID getProjectId() {
    return projectId;
  }

  public String getTimelineKey() {
    return timelineKey;
  }

  public String getAgeState() {
    return ageState;
  }

  public String getHairstyle() {
    return hairstyle;
  }

  public String getInjury() {
    return injury;
  }

  public String getWardrobeContext() {
    return wardrobeContext;
  }

  public String getAppearancePrompt() {
    return appearancePrompt;
  }

  public UUID getOutfitVersionId() {
    return outfitVersionId;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
