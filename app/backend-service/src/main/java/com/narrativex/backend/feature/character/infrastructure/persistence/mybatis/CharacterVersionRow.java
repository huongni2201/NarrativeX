package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterVersionRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID characterId;
  private int versionNumber;
  private String bible;
  private String visualPrompt;
  private String status;
  private Instant lockedAt;
  private String lockedBy;
}
