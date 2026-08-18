package com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "chapters",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_chapters_story_order",
            columnNames = {"story_version_id", "order_index"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChapterJpaEntity extends JpaAuditedEntity {
  @Column(name = "story_version_id", nullable = false)
  private Long storyVersionId;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Column(name = "title", nullable = false, length = 200)
  private String title;

  @Column(name = "source_text", columnDefinition = "TEXT")
  private String sourceText;

  @Column(name = "status", nullable = false, length = 24)
  private String status;

  @Column(name = "estimated_duration_ms")
  private Long estimatedDurationMs;

  @Column(name = "generation_progress", nullable = false)
  private int generationProgress;

  @Column(name = "source_story_version_id")
  private Long sourceStoryVersionId;

  @Column(name = "inherited_snapshot_hash", length = 128)
  private String inheritedSnapshotHash;
}

