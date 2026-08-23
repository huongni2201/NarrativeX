package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterVersionRow {
  private Long id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private Long characterId;
  private int versionNumber;
  private String bible;
  private String visualPrompt;
  private Long masterAssetId;
  private String referenceAssetIdsJson;
  private String status;
  private Instant lockedAt;
  private String lockedBy;
}
