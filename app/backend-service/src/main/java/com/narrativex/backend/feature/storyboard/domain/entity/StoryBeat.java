package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.util.Objects;
import java.util.UUID;

/**
 * Coherent dramatic or semantic event within a Scene. Acts as the shared semantic parent for what
 * the audience hears (AudioCue[]) and what the audience sees (VisualBeat[]).
 */
public final class StoryBeat extends DomainEntity {
  private static final int MAX_PURPOSE_LENGTH = 64;
  private static final int MAX_SUMMARY_LENGTH = 8000;
  private static final int MAX_IMPORTANCE_LENGTH = 24;

  private final UUID sceneId;
  private final int orderIndex;
  private final Integer sourceStart;
  private final Integer sourceEnd;
  private final String sourceAnchorJson;
  private final String purpose;
  private final String summary;
  private final String importance;
  private final String storyFunctionsJson;
  private final String continuityStateJson;
  private final String reviewStatus;

  public StoryBeat(
      UUID sceneId,
      int orderIndex,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      String purpose,
      String summary,
      String importance,
      String storyFunctionsJson,
      String continuityStateJson) {
    this(
        null,
        0L,
        sceneId,
        orderIndex,
        sourceStart,
        sourceEnd,
        sourceAnchorJson,
        purpose,
        summary,
        importance,
        storyFunctionsJson,
        continuityStateJson,
        "NEEDS_REVIEW");
  }

  public StoryBeat(
      UUID sceneId,
      int orderIndex,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      String purpose,
      String summary,
      String importance,
      String storyFunctionsJson,
      String continuityStateJson,
      String reviewStatus) {
    this(
        null,
        0L,
        sceneId,
        orderIndex,
        sourceStart,
        sourceEnd,
        sourceAnchorJson,
        purpose,
        summary,
        importance,
        storyFunctionsJson,
        continuityStateJson,
        reviewStatus);
  }

  private StoryBeat(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      String purpose,
      String summary,
      String importance,
      String storyFunctionsJson,
      String continuityStateJson,
      String reviewStatus) {
    super(id, rowVersion);
    this.sceneId = Objects.requireNonNull(sceneId, "sceneId must not be null");
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    this.orderIndex = orderIndex;
    if (sourceStart != null && sourceEnd != null) {
      if (sourceStart < 0 || sourceEnd <= sourceStart) {
        throw new IllegalArgumentException(
            "sourceStart must be >= 0 and < sourceEnd, got ["
                + sourceStart
                + ", "
                + sourceEnd
                + "]");
      }
    }
    this.sourceStart = sourceStart;
    this.sourceEnd = sourceEnd;
    this.sourceAnchorJson = sourceAnchorJson;
    this.purpose = defaultIfBlank(purpose, "PLOT", MAX_PURPOSE_LENGTH);
    this.summary = summary != null ? summary.trim() : "";
    if (this.summary.length() > MAX_SUMMARY_LENGTH) {
      throw new IllegalArgumentException("summary exceeds maximum length " + MAX_SUMMARY_LENGTH);
    }
    this.importance = defaultIfBlank(importance, "NORMAL", MAX_IMPORTANCE_LENGTH);
    this.storyFunctionsJson = storyFunctionsJson != null ? storyFunctionsJson.trim() : "[]";
    this.continuityStateJson = continuityStateJson != null ? continuityStateJson.trim() : "{}";
    this.reviewStatus = defaultIfBlank(reviewStatus, "NEEDS_REVIEW", 32);
  }

  public static StoryBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      String purpose,
      String summary,
      String importance,
      String storyFunctionsJson,
      String continuityStateJson,
      String reviewStatus) {
    return new StoryBeat(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        sourceStart,
        sourceEnd,
        sourceAnchorJson,
        purpose,
        summary,
        importance,
        storyFunctionsJson,
        continuityStateJson,
        reviewStatus);
  }

  public static StoryBeat rehydrate(
      UUID id,
      long rowVersion,
      UUID sceneId,
      int orderIndex,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      String purpose,
      String summary,
      String importance,
      String storyFunctionsJson,
      String continuityStateJson) {
    return rehydrate(
        id,
        rowVersion,
        sceneId,
        orderIndex,
        sourceStart,
        sourceEnd,
        sourceAnchorJson,
        purpose,
        summary,
        importance,
        storyFunctionsJson,
        continuityStateJson,
        "NEEDS_REVIEW");
  }

  public UUID getSceneId() {
    return sceneId;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public Integer getSourceStart() {
    return sourceStart;
  }

  public Integer getSourceEnd() {
    return sourceEnd;
  }

  public String getSourceAnchorJson() {
    return sourceAnchorJson;
  }

  public String getPurpose() {
    return purpose;
  }

  public String getSummary() {
    return summary;
  }

  public String getImportance() {
    return importance;
  }

  public String getStoryFunctionsJson() {
    return storyFunctionsJson;
  }

  public String getContinuityStateJson() {
    return continuityStateJson;
  }

  public String getReviewStatus() {
    return reviewStatus;
  }

  public StoryBeat withReviewStatus(String newStatus) {
    return new StoryBeat(
        getId(),
        getRowVersion(),
        this.sceneId,
        this.orderIndex,
        this.sourceStart,
        this.sourceEnd,
        this.sourceAnchorJson,
        this.purpose,
        this.summary,
        this.importance,
        this.storyFunctionsJson,
        this.continuityStateJson,
        newStatus);
  }

  private static String defaultIfBlank(String value, String fallback, int maxLength) {
    if (value == null || value.isBlank()) return fallback;
    String trimmed = value.trim();
    if (trimmed.length() > maxLength) {
      throw new IllegalArgumentException("value exceeds maximum length " + maxLength);
    }
    return trimmed;
  }
}
