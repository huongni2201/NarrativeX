package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VisualBeatRow {
  private UUID id;
  private long rowVersion;
  private UUID sceneId;
  private int orderIndex;
  private String title;
  private String visualIntent;
  private String visualDirectionJson;
  private String reviewStatus;
  private String motionMode;
  private String cameraMovement;
  private String cameraAngle;
  private String aspectRatioOverride;
  private String qualityTierOverride;
  private UUID previewMediaAssetId;
  private Instant createdAt;
  private Instant updatedAt;
}
