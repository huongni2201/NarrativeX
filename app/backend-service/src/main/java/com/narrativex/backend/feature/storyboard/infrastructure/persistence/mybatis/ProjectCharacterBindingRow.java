package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectCharacterBindingRow {
  private UUID projectCharacterId;
  private UUID projectId;
  private UUID characterId;
  private String canonicalName;
  private String characterAliasesJson;
  private String projectAliasesJson;
  private String role;
  private String importance;
  private UUID pinnedCharacterVersionId;
  private String bible;
  private String visualPrompt;
  private String versionStatus;
  private Instant versionLockedAt;
  private String aiName;
  private String aiAliasesJson;
}
