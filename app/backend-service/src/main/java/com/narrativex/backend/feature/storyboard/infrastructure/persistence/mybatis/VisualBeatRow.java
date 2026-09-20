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
  private UUID storyBeatId;
  private int orderIndex;
  private String title;
  private String visualIntent;
  private String beatType;
  private String visualSummary;
  private String visualDescription;
  private String visualDirectionJson;
  private String dramaticIntent;
  private String emotion;
  private String retentionRole;
  private String reviewStatus;
  private String motionMode;
  private Double relativeWeight;
  private String visualFocus;
  private String aspectRatioOverride;
  private UUID previewMediaAssetId;
  private Integer textStart;
  private Integer textEnd;
  private Long audioDurationMs;
  private String sourceAnchorJson;
  private Instant createdAt;
  private Instant updatedAt;
}
