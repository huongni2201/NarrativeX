package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private String ownerId;
  private String workspaceId;
  private String canonicalName;
  private String aliasesJson;
  private String status;
}
