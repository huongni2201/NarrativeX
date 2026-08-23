package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterAppearanceRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID characterId;
  private UUID projectId;
  private String timelineKey;
  private String ageState;
  private String hairstyle;
  private String injury;
  private String wardrobeContext;
  private String appearancePrompt;
  private UUID outfitVersionId;
}
