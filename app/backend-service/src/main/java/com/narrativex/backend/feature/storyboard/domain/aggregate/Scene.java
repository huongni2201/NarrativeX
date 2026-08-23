package com.narrativex.backend.feature.storyboard.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import com.narrativex.backend.feature.storyboard.domain.exception.InvalidSceneTransitionException;
import java.util.Objects;
import java.util.UUID;

/** Scene aggregate optimized for independent editing and AI generation. */
public final class Scene extends AggregateRoot {
  private final UUID chapterId;
  private int orderIndex;
  private String title;
  private String narration;
  private Integer durationSeconds;
  private SceneStatus status;

  public Scene(UUID chapterId, int orderIndex, String title) {
    this(null, 0L, chapterId, orderIndex, title, null, null, SceneStatus.DRAFT);
  }

  private Scene(
      UUID id,
      long rowVersion,
      UUID chapterId,
      int orderIndex,
      String title,
      String narration,
      Integer durationSeconds,
      SceneStatus status) {
    super(id, rowVersion);
    this.chapterId = Objects.requireNonNull(chapterId, "chapterId");
    this.orderIndex = validOrderIndex(orderIndex);
    this.title = requiredTitle(title);
    this.narration = normalizeOptionalText(narration);
    this.durationSeconds = validDuration(durationSeconds);
    this.status = Objects.requireNonNull(status, "status");
  }

  public static Scene rehydrate(
      UUID id,
      long rowVersion,
      UUID chapterId,
      int orderIndex,
      String title,
      String narration,
      Integer durationSeconds,
      SceneStatus status) {
    return new Scene(
        id, rowVersion, chapterId, orderIndex, title, narration, durationSeconds, status);
  }

  public void rename(String newTitle) {
    ensureEditable();
    title = requiredTitle(newTitle);
  }

  public void reorder(int newOrderIndex) {
    ensureEditable();
    orderIndex = validOrderIndex(newOrderIndex);
  }

  public void updateNarration(String newNarration) {
    ensureEditable();
    narration = normalizeOptionalText(newNarration);
  }

  public void overrideDuration(Integer newDurationSeconds) {
    ensureEditable();
    durationSeconds = validDuration(newDurationSeconds);
  }

  public void markReadyForVisual() {
    transition(SceneStatus.DRAFT, SceneStatus.READY_FOR_VISUAL);
  }

  public void startGeneration() {
    transition(SceneStatus.READY_FOR_VISUAL, SceneStatus.GENERATING);
  }

  public void submitForReview() {
    transition(SceneStatus.GENERATING, SceneStatus.REVIEW);
  }

  public void approve() {
    transition(SceneStatus.REVIEW, SceneStatus.APPROVED);
  }

  public void failGeneration() {
    transition(SceneStatus.GENERATING, SceneStatus.FAILED);
  }

  /** Marks a previously materialized scene snapshot stale without deleting its existing outputs. */
  public void markOutdated() {
    if (status == SceneStatus.DRAFT || status == SceneStatus.OUTDATED) {
      throw new InvalidSceneTransitionException(
          "Scene cannot transition from " + status + " to OUTDATED");
    }
    status = SceneStatus.OUTDATED;
  }

  private void transition(SceneStatus expected, SceneStatus target) {
    if (status != expected) {
      throw new InvalidSceneTransitionException(
          "Scene cannot transition from " + status + " to " + target);
    }
    status = target;
  }

  private void ensureEditable() {
    if (status == SceneStatus.GENERATING || status == SceneStatus.REVIEW) {
      throw new InvalidSceneTransitionException("Scene cannot be edited while status is " + status);
    }
    if (status == SceneStatus.APPROVED) {
      status = SceneStatus.OUTDATED;
    }
  }

  public UUID getChapterId() {
    return chapterId;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public String getTitle() {
    return title;
  }

  public String getNarration() {
    return narration;
  }

  public Integer getDurationSeconds() {
    return durationSeconds;
  }

  public SceneStatus getStatus() {
    return status;
  }

  private static int validOrderIndex(int value) {
    if (value < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    return value;
  }

  private static String requiredTitle(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("title must not be blank");
    }
    if (value.length() > 200) {
      throw new IllegalArgumentException("title exceeds the maximum length");
    }
    return value;
  }

  private static String normalizeOptionalText(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private static Integer validDuration(Integer value) {
    if (value != null && value < 0) {
      throw new IllegalArgumentException("durationSeconds must not be negative");
    }
    return value;
  }
}
