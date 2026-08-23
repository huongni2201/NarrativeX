package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SceneRow {
  private Long id;
  private long rowVersion;
  private Long chapterId;
  private int orderIndex;
  private String title;
  private String narration;
  private Integer durationSeconds;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
}
