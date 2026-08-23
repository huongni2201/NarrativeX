package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterAppearanceRow {
  private Long id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private Long characterId;
  private Long projectId;
  private String timelineKey;
  private String ageState;
  private String hairstyle;
  private String injury;
  private String wardrobeContext;
  private String appearancePrompt;
  private Long outfitVersionId;
}
