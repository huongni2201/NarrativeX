package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectCharacterReadRow {
  private UUID assignmentId;
  private UUID characterId;
  private UUID projectId;
  private String workspaceId;
  private String canonicalName;
  private String aliasesJson;
  private String projectAliasesJson;
  private String role;
  private int importance;
  private String groupsJson;
  private UUID pinnedCharacterVersionId;
  private String status;
  private int sceneCount;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID characterVersionId;
  private Integer versionNumber;
  private String versionStatus;
  private String bible;
  private String visualPrompt;
  private String ageState;
  private String hairstyle;
  private String injury;
  private String wardrobeContext;
  private String appearancePrompt;
}
