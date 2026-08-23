package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectOverviewChapterRow {
  private UUID id;
  private int orderIndex;
  private String title;
  private String status;
  private int sceneCount;
  private long durationSeconds;
  private Instant updatedAt;
}
