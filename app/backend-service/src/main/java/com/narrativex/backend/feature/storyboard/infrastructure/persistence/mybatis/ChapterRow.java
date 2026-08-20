package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Persistence-only representation of one complete row in {@code chapters}. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChapterRow {
  private Long id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private Long storyVersionId;
  private int orderIndex;
  private String title;
  private String sourceText;
  private String sourceHash;
  private String status;
  private Long estimatedDurationMs;
  private int generationProgress;
  private Long sourceStoryVersionId;
  private String inheritedSnapshotHash;
}
