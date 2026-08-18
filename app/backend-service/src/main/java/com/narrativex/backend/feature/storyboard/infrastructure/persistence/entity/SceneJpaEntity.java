package com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "scenes",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_scenes_chapter_order",
            columnNames = {"chapter_id", "order_index"}))
public class SceneJpaEntity extends JpaAuditedEntity {
  @Column(name = "chapter_id", nullable = false)
  private Long chapterId;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Column(name = "title", nullable = false, length = 200)
  private String title;

  @Column(name = "narration", columnDefinition = "TEXT")
  private String narration;

  @Column(name = "duration_seconds")
  private Integer durationSeconds;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 24)
  private SceneStatus status;

  protected SceneJpaEntity() {}
}
