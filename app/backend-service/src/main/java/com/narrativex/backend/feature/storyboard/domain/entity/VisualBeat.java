package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.DramaticIntent;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.Objects;
import java.util.UUID;
import lombok.Getter;

/** Visual dramatic beat within a Scene. Contains dramatic intent and maps to a ShotSequence. */
public final class VisualBeat extends DomainEntity {
  private static final int MAX_TITLE_LENGTH = 200;
  private static final int MAX_VISUAL_INTENT_LENGTH = 8000;
  private static final int MAX_VISUAL_DIRECTION_LENGTH = 16000;
  private static final int MAX_VISUAL_FOCUS_LENGTH = 64;

  @Getter private final UUID sceneId;
  @Getter private final UUID storyBeatId;
  @Getter private final int orderIndex;
  @Getter private final String title;
  @Getter private final String visualIntent;
  @Getter private final String visualDirectionJson;
  @Getter private final MotionMode motionMode;
  @Getter private final AspectRatio aspectRatioOverride;
  @Getter private final double relativeWeight;
  @Getter private final String visualFocus;
  @Getter private final Integer textStart;
  @Getter private final Integer textEnd;
  @Getter private final String sourceAnchorJson;
  @Getter private final DramaticIntent dramaticIntent;
  @Getter private final String emotion;
  @Getter private final RetentionRole retentionRole;
  @Getter private VisualBeatReviewStatus reviewStatus;
  @Getter private UUID previewMediaAssetId;

  public VisualBeat(UUID sceneId, int orderIndex, String visualIntent) {
    this(sceneId, orderIndex, defaultTitle(visualIntent), visualIntent);
  }

  public VisualBeat(UUID sceneId, int orderIndex, String title, String visualIntent) {
    this(
        null,
        0L,
        sceneId,
        null,
        orderIndex,
        title,
        visualIntent,
        null,
        MotionMode.STILL,
        null,
        1.0,
        "SPEAKER",
        null,
        null,
        null,
        VisualBeatReviewStatus.NEEDS_REVIEW);
  }

  public VisualBeat(
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      AspectRatio aspectRatioOverride,
      double relativeWeight,
      String visualFocus,
      Integer textStart,
      Integer textEnd,
      String sourceAnchorJson,
      VisualBeatReviewStatus reviewStatus) {
    this(
        null,
        0L,
        sceneId,
        storyBeatId,
        orderIndex,
        title,
        visualIntent,
        visualDirectionJson,
        motionMode,
        aspectRatioOverride,
        relativeWeight,
        visualFocus,
        textStart,
        textEnd,
        sourceAnchorJson,
        reviewStatus);
  }

  private VisualBeat(
      UUID id,
      long rowVersion,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      AspectRatio aspectRatioOverride,
      double relativeWeight,
      String visualFocus,
      Integer textStart,
      Integer textEnd,
      String sourceAnchorJson,
      VisualBeatReviewStatus reviewStatus) {
    this(
        id,
        rowVersion,
        sceneId,
        storyBeatId,
        orderIndex,
        title,
        visualIntent,
        visualDirectionJson,
        motionMode,
        aspectRatioOverride,
        relativeWeight,
        visualFocus,
        textStart,
        textEnd,
        sourceAnchorJson,
        DramaticIntent.SETUP,
        null,
        null,
        reviewStatus);
  }

  private VisualBeat(
      UUID id,
      long rowVersion,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      AspectRatio aspectRatioOverride,
      double relativeWeight,
      String visualFocus,
      Integer textStart,
      Integer textEnd,
      String sourceAnchorJson,
      DramaticIntent dramaticIntent,
      String emotion,
      RetentionRole retentionRole,
      VisualBeatReviewStatus reviewStatus) {
    super(id, rowVersion);
    this.sceneId = Objects.requireNonNull(sceneId, "sceneId");
    this.storyBeatId = storyBeatId;
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    this.orderIndex = orderIndex;
    this.title = requiredText(title, "title", MAX_TITLE_LENGTH);
    this.visualIntent = requiredText(visualIntent, "visualIntent", MAX_VISUAL_INTENT_LENGTH);
    this.visualDirectionJson = optionalText(visualDirectionJson, MAX_VISUAL_DIRECTION_LENGTH);
    this.motionMode = Objects.requireNonNull(motionMode, "motionMode");
    this.aspectRatioOverride = aspectRatioOverride;
    if (relativeWeight <= 0) {
      throw new IllegalArgumentException("relativeWeight must be positive, got " + relativeWeight);
    }
    this.relativeWeight = relativeWeight;
    this.visualFocus = defaultIfBlank(visualFocus, "SPEAKER", MAX_VISUAL_FOCUS_LENGTH);
    this.textStart = textStart;
    this.textEnd = textEnd;
    this.sourceAnchorJson = sourceAnchorJson;
    this.dramaticIntent = dramaticIntent != null ? dramaticIntent : DramaticIntent.SETUP;
    this.emotion = emotion;
    this.retentionRole = retentionRole;
    this.reviewStatus = Objects.requireNonNull(reviewStatus, "reviewStatus");
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
      AspectRatio aspectRatioOverride,
      VisualBeatReviewStatus reviewStatus) {
    return new VisualBeat(
        id,
        rowVersion,
        sceneId,
        null,
        orderIndex,
        title,
        visualIntent,
        visualDirectionJson,
        motionMode,
        aspectRatioOverride,
        1.0,
        "SPEAKER",
        null,
        null,
        null,
        reviewStatus);
  }

  public static VisualBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      AspectRatio aspectRatioOverride,
      double relativeWeight,
      String visualFocus,
      Integer textStart,
      Integer textEnd,
      String sourceAnchorJson,
      VisualBeatReviewStatus reviewStatus) {
    return rehydrate(
        id,
        rowVersion,
        sceneId,
        storyBeatId,
        orderIndex,
        title,
        visualIntent,
        visualDirectionJson,
        motionMode,
        aspectRatioOverride,
        relativeWeight,
        visualFocus,
        textStart,
        textEnd,
        sourceAnchorJson,
        DramaticIntent.SETUP,
        null,
        null,
        reviewStatus);
  }

  public static VisualBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualDirectionJson,
      MotionMode motionMode,
      AspectRatio aspectRatioOverride,
      double relativeWeight,
      String visualFocus,
      Integer textStart,
      Integer textEnd,
      String sourceAnchorJson,
      DramaticIntent dramaticIntent,
      String emotion,
      RetentionRole retentionRole,
      VisualBeatReviewStatus reviewStatus) {
    return new VisualBeat(
        id,
        rowVersion,
        sceneId,
        storyBeatId,
        orderIndex,
        title,
        visualIntent,
        visualDirectionJson,
        motionMode,
        aspectRatioOverride,
        relativeWeight,
        visualFocus,
        textStart,
        textEnd,
        sourceAnchorJson,
        dramaticIntent,
        emotion,
        retentionRole,
        reviewStatus);
  }

  public void changeReviewStatus(VisualBeatReviewStatus newStatus) {
    reviewStatus = Objects.requireNonNull(newStatus, "newStatus");
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

  private static String defaultIfBlank(String value, String fallback, int maxLength) {
    if (value == null || value.isBlank()) return fallback;
    String trimmed = value.trim();
    if (trimmed.length() > maxLength) {
      throw new IllegalArgumentException("value exceeds maximum length " + maxLength);
    }
    return trimmed;
  }

  private static String defaultTitle(String visualIntent) {
    if (visualIntent == null || visualIntent.isBlank()) {
      return "Visual beat";
    }
    String normalized = visualIntent.trim().replaceAll("\\s+", " ");
    return normalized.substring(0, Math.min(MAX_TITLE_LENGTH, normalized.length()));
  }
}
