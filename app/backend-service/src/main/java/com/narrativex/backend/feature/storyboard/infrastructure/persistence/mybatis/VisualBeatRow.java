package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VisualBeatRow {
  private Long id;
  private long rowVersion;
  private Long sceneId;
  private int orderIndex;
  private String title;
  private String visualIntent;
  private String reviewStatus;
  private String motionMode;
  private String cameraMovement;
  private String aspectRatioOverride;
  private String qualityTierOverride;
  private Long previewAssetId;
  private Instant createdAt;
  private Instant updatedAt;
}
