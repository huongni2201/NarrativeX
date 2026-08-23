package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OutfitVersionRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID characterId;
  private int versionNumber;
  private String name;
  private String description;
  private String prompt;
  private String status;
}
