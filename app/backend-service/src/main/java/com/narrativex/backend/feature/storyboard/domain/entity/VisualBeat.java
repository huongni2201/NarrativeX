package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraAngle;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.Objects;
import java.util.UUID;

public final class VisualBeat extends DomainEntity {
  private static final int MAX_TITLE_LENGTH = 200;
  private static final int MAX_VISUAL_INTENT_LENGTH = 8000;
  private static final int MAX_VISUAL_DIRECTION_LENGTH = 16000;

  private final UUID sceneId;
  private final int orderIndex;
  private final String title;
  private final String visualIntent;
  private final String visualDirectionJson;
  private final MotionMode motionMode;
  private final CameraMovement cameraMovement;
  private final CameraAngle cameraAngle;
  private final AspectRatio aspectRatioOverride;
  private VisualBeatReviewStatus reviewStatus;
  private UUID previewMediaAssetId;

  public VisualBeat(UUID sceneId, int orderIndex, String visualIntent) {
    this(sceneId, orderIndex, defaultTitle(visualIntent), visualIntent);
  }

  public VisualBeat(UUID sceneId, int orderIndex, String title, String visualIntent) {
    this(
        null,
        0L,
        sceneId,
        orderIndex,
        title,
        visualIntent,
        null,
        MotionMode.STILL,
        CameraMovement.NONE,
        CameraAngle.MEDIUM,
        null,
        VisualBeatReviewStatus.NEEDS_REVIEW);
  }

  private VisualBeat(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      CameraAngle cameraAngle,
      AspectRatio aspectRatioOverride,
      VisualBeatReviewStatus reviewStatus) {
    super(id, rowVersion);
    this.sceneId = Objects.requireNonNull(sceneId, "sceneId");
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    this.orderIndex = orderIndex;
    this.title = requiredText(title, "title", MAX_TITLE_LENGTH);
    this.visualIntent = requiredText(visualIntent, "visualIntent", MAX_VISUAL_INTENT_LENGTH);
    this.visualDirectionJson = optionalText(visualDirectionJson, MAX_VISUAL_DIRECTION_LENGTH);
    this.motionMode = Objects.requireNonNull(motionMode, "motionMode");
    this.cameraMovement = Objects.requireNonNull(cameraMovement, "cameraMovement");
    this.cameraAngle = Objects.requireNonNull(cameraAngle, "cameraAngle");
    this.aspectRatioOverride = aspectRatioOverride;
    this.reviewStatus = Objects.requireNonNull(reviewStatus, "reviewStatus");
  }

  public static VisualBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      String visualIntent,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      CameraAngle cameraAngle,
      AspectRatio aspectRatioOverride) {
    return rehydrate(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        defaultTitle(visualIntent),
        visualIntent,
        null,
        motionMode,
        cameraMovement,
        cameraAngle,
        aspectRatioOverride,
        VisualBeatReviewStatus.NEEDS_REVIEW);
  }

  public static VisualBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      String title,
      String visualIntent,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      CameraAngle cameraAngle,
      AspectRatio aspectRatioOverride,
      VisualBeatReviewStatus reviewStatus) {
    return rehydrate(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        title,
        visualIntent,
        null,
        motionMode,
        cameraMovement,
        cameraAngle,
        aspectRatioOverride,
        reviewStatus);
  }

  public static VisualBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      CameraMovement cameraMovement,
      CameraAngle cameraAngle,
      AspectRatio aspectRatioOverride,
      VisualBeatReviewStatus reviewStatus) {
    return new VisualBeat(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        title,
        visualIntent,
        visualDirectionJson,
        motionMode,
        cameraMovement,
        cameraAngle,
        aspectRatioOverride,
        reviewStatus);
  }

  public void changeReviewStatus(VisualBeatReviewStatus newStatus) {
    reviewStatus = Objects.requireNonNull(newStatus, "newStatus");
  }

  public UUID getSceneId() {
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

  public String getVisualDirectionJson() {
    return visualDirectionJson;
  }

  public MotionMode getMotionMode() {
    return motionMode;
  }

  public CameraMovement getCameraMovement() {
    return cameraMovement;
  }

  public CameraAngle getCameraAngle() {
    return cameraAngle;
  }

  public AspectRatio getAspectRatioOverride() {
    return aspectRatioOverride;
  }

  public VisualBeatReviewStatus getReviewStatus() {
    return reviewStatus;
  }

  public UUID getPreviewMediaAssetId() {
    return previewMediaAssetId;
  }

  public void attachPreviewMediaAsset(UUID previewMediaAssetId) {
    this.previewMediaAssetId = Objects.requireNonNull(previewMediaAssetId, "previewMediaAssetId");
    this.reviewStatus = VisualBeatReviewStatus.NEEDS_REVIEW;
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

  private static String optionalText(String value, int maxLength) {
    if (value == null || value.isBlank()) return null;
    String normalized = value.trim();
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException("visualDirectionJson exceeds the maximum length");
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
