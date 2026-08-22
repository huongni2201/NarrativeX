package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MediaStorageCleanupTaskRow {
  private UUID id;
  private String storageKey;
  private String reason;
  private String status;
  private int attemptCount;
  private Instant nextAttemptAt;
}
