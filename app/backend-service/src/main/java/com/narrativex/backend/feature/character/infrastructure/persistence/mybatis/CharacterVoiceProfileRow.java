package com.narrativex.backend.feature.character.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterVoiceProfileRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID characterId;
  private int versionNumber;
  private UUID referenceAssetId;
  private String referenceScope;
  private String language;
  private String accent;
  private String voiceDescription;
  private String deliveryBaseline;
  private String status;
  private Instant lockedAt;
}
