package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.Objects;

public final class VisualBeat extends DomainEntity {
  private static final int MAX_TITLE_LENGTH = 200;
  private static final int MAX_VISUAL_INTENT_LENGTH = 8000;

  private final Long sceneId;
  private final int orderIndex;
  private final String title;
  private final String visualIntent;
  private final MotionMode motionMode;
  private final CameraMovement cameraMovement;
  private final AspectRatio aspectRatioOverride;
  private final ImageQualityTier qualityTierOverride;
  private VisualBeatReviewStatus reviewStatus;

  public VisualBeat(Long sceneId, int orderIndex, String visualIntent) {
    this(sceneId, orderIndex, defaultTitle(visualIntent), visualIntent);
  }

  public VisualBeat(Long sceneId, int orderIndex, String title, String visualIntent) {
    this(
        null,
        0L,
        sceneId,
        orderIndex,
        title,
        visualIntent,
        MotionMode.STILL,
        CameraMovement.NONE,
        null,
        null,
        VisualBeatReviewStatus.NEEDS_REVIEW);
  }

  private VisualBeat(
      Long id,
      long rowVersion,
      Long sceneId,
      int orderIndex,
      String title,
      String visualIntent,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      AspectRatio aspectRatioOverride,
      ImageQualityTier qualityTierOverride,
      VisualBeatReviewStatus reviewStatus) {
    super(id, rowVersion);
    if (sceneId == null || sceneId <= 0) {
      throw new IllegalArgumentException("sceneId must be positive");
    }
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    this.sceneId = sceneId;
    this.orderIndex = orderIndex;
    this.title = requiredText(title, "title", MAX_TITLE_LENGTH);
    this.visualIntent = requiredText(visualIntent, "visualIntent", MAX_VISUAL_INTENT_LENGTH);
    this.motionMode = Objects.requireNonNull(motionMode, "motionMode");
    this.cameraMovement = Objects.requireNonNull(cameraMovement, "cameraMovement");
    this.aspectRatioOverride = aspectRatioOverride;
    this.qualityTierOverride = qualityTierOverride;
    this.reviewStatus = Objects.requireNonNull(reviewStatus, "reviewStatus");
  }

  public static VisualBeat rehydrate(
      Long id,
      long rowVersion,
      Long sceneId,
      int orderIndex,
      String visualIntent,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      AspectRatio aspectRatioOverride,
      ImageQualityTier qualityTierOverride) {
    return new VisualBeat(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        defaultTitle(visualIntent),
        visualIntent,
        motionMode,
        cameraMovement,
        aspectRatioOverride,
        qualityTierOverride,
        VisualBeatReviewStatus.NEEDS_REVIEW);
  }

  public static VisualBeat rehydrate(
      Long id,
      long rowVersion,
      Long sceneId,
      int orderIndex,
      String title,
      String visualIntent,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      AspectRatio aspectRatioOverride,
      ImageQualityTier qualityTierOverride,
      VisualBeatReviewStatus reviewStatus) {
    return new VisualBeat(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        title,
        visualIntent,
        motionMode,
        cameraMovement,
        aspectRatioOverride,
        qualityTierOverride,
        reviewStatus);
  }

  public void changeReviewStatus(VisualBeatReviewStatus newStatus) {
    reviewStatus = Objects.requireNonNull(newStatus, "newStatus");
  }

  public Long getSceneId() {
    return sceneId;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public String getTitle() {
    return title;
  }

  public String getVisualIntent() {
    return visualIntent;
  }

  public MotionMode getMotionMode() {
    return motionMode;
  }

  public CameraMovement getCameraMovement() {
    return cameraMovement;
  }

  public AspectRatio getAspectRatioOverride() {
    return aspectRatioOverride;
  }

  public ImageQualityTier getQualityTierOverride() {
    return qualityTierOverride;
  }

  public VisualBeatReviewStatus getReviewStatus() {
    return reviewStatus;
  }

  private static String requiredText(String value, String field, int maxLength) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    String normalized = value.trim();
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException(field + " exceeds the maximum length");
    }
    return normalized;
  }

  private static String defaultTitle(String visualIntent) {
    if (visualIntent == null || visualIntent.isBlank()) {
      return "Visual beat";
    }
    String normalized = visualIntent.trim().replaceAll("\\s+", " ");
    return normalized.substring(0, Math.min(MAX_TITLE_LENGTH, normalized.length()));
  }
}
