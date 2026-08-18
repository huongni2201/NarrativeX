package com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionAction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "visual_beats",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_visual_beats_scene_order",
            columnNames = {"scene_id", "order_index"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisualBeatJpaEntity extends JpaAuditedEntity {
  @Column(name = "scene_id", nullable = false)
  private Long sceneId;

  @Column(name = "order_index", nullable = false)
  private int orderIndex;

  @Column(name = "visual_intent", nullable = false, columnDefinition = "TEXT")
  private String visualIntent;

  @Enumerated(EnumType.STRING)
  @Column(name = "motion_action", nullable = false, length = 24)
  private MotionAction motionAction;

  @Enumerated(EnumType.STRING)
  @Column(name = "aspect_ratio_override", length = 16)
  private AspectRatio aspectRatioOverride;

  @Enumerated(EnumType.STRING)
  @Column(name = "quality_tier_override", length = 16)
  private ImageQualityTier qualityTierOverride;
}
