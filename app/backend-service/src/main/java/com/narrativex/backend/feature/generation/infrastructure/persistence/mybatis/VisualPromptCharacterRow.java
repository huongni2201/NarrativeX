package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VisualPromptCharacterRow {
  private Long assignmentId;
  private Long characterId;
  private String canonicalName;
  private Integer versionNumber;
  private String visualPrompt;
  private String appearancePrompt;
  private String ageState;
  private String hairstyle;
  private String injury;
  private String wardrobeContext;
  private Long masterAssetId;
  private String masterAssetStorageKey;
  private String masterAssetMimeType;
}
