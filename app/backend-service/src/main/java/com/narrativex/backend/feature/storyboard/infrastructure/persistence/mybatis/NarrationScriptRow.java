package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NarrationScriptRow {
  private UUID id;
  private long rowVersion;
  private UUID chapterId;
  private UUID storyboardRevisionId;
  private String sourceHash;
  private int version;
  private String adaptationMode;
  private String text;
  private String contentHash;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
}
