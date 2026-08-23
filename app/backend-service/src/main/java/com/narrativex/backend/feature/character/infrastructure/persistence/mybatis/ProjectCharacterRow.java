package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectCharacterRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID projectId;
  private UUID characterId;
  private String role;
  private int importance;
  private String projectAliasesJson;
  private String storyMetadata;
  private String groupsJson;
  private UUID pinnedCharacterVersionId;
  private String status;
}
