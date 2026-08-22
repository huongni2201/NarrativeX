package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class ProjectCharacterRow {
  private Long id; private long rowVersion; private Instant createdAt; private Instant updatedAt;
  private Long projectId; private Long characterId; private String role; private int importance;
  private String projectAliasesJson; private String storyMetadata; private String groupsJson;
  private Long pinnedCharacterVersionId; private String status;
}
