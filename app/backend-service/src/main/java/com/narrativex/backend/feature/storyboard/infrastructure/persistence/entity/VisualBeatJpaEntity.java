package com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity;

import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
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

  @Column(name = "title", nullable = false, length = 200)
  private String title;

  @Column(name = "visual_intent", nullable = false, columnDefinition = "TEXT")
  private String visualIntent;

  @Enumerated(EnumType.STRING)
  @Column(name = "review_status", nullable = false, length = 24)
  private VisualBeatReviewStatus reviewStatus;

  @Enumerated(EnumType.STRING)
  @Column(name = "motion_mode", nullable = false, length = 24)
  private MotionMode motionMode;

  @Enumerated(EnumType.STRING)
  @Column(name = "camera_movement", nullable = false, length = 32)
  private CameraMovement cameraMovement;

  @Enumerated(EnumType.STRING)
  @Column(name = "aspect_ratio_override", length = 16)
  private AspectRatio aspectRatioOverride;

  @Enumerated(EnumType.STRING)
  @Column(name = "quality_tier_override", length = 16)
  private ImageQualityTier qualityTierOverride;

  @Column(name = "preview_asset_id")
  private Long previewAssetId;
}
