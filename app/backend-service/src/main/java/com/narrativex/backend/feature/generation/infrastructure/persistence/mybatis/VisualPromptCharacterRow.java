package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VisualPromptCharacterRow {
  private UUID assignmentId;
  private UUID characterId;
  private String canonicalName;
  private Integer versionNumber;
  private String visualPrompt;
  private String appearancePrompt;
  private String ageState;
  private String hairstyle;
  private String injury;
  private String wardrobeContext;
  private String beatRole;
}
