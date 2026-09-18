package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SceneRow {
  private UUID id;
  private long rowVersion;
  private UUID chapterId;
  private UUID storyboardRevisionId;
  private UUID projectId;
  private int orderIndex;
  private String title;
  private String narration;
  private Integer durationSeconds;
  private UUID projectLocationId;
  private String locationText;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
}
