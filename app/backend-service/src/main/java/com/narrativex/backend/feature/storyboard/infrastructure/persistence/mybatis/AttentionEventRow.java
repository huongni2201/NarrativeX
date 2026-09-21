package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AttentionEventRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID retentionMapId;
  private String eventType;
  private long timeOffsetMs;
  private String description;
  private String severity;
}
