package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
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
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID storyVersionId;
  private int orderIndex;
  private String title;
  private String sourceText;
  private String sourceHash;
  private String status;
  private Long estimatedDurationMs;
  private int generationProgress;
  private UUID sourceStoryVersionId;
  private String inheritedSnapshotHash;
}
