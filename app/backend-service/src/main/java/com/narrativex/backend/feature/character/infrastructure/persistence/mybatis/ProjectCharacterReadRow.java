package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectCharacterReadRow {
  private Long assignmentId;
  private Long characterId;
  private Long projectId;
  private String workspaceId;
  private String canonicalName;
  private String aliasesJson;
  private String projectAliasesJson;
  private String role;
  private int importance;
  private String groupsJson;
  private Long pinnedCharacterVersionId;
  private String status;
  private int sceneCount;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
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
