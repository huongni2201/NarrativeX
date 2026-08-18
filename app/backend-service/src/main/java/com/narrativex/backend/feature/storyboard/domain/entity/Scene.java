package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;

public final class Scene extends DomainEntity {
  private final Long chapterId;
  private final int orderIndex;
  private final String title;
  private final String narration;
  private final Integer durationSeconds;

  public Scene(Long chapterId, int orderIndex, String title) {
    this(null, 0L, chapterId, orderIndex, title, null, null);
  }

  private Scene(
      Long id,
      long rowVersion,
      Long chapterId,
      int orderIndex,
      String title,
      String narration,
      Integer durationSeconds) {
    super(id, rowVersion);
    if (chapterId == null || chapterId <= 0)
      throw new IllegalArgumentException("chapterId must be positive");
    if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");
    if (title == null || title.isBlank())
      throw new IllegalArgumentException("title must not be blank");
    if (durationSeconds != null && durationSeconds < 0)
      throw new IllegalArgumentException("durationSeconds must not be negative");
    this.chapterId = chapterId;
    this.orderIndex = orderIndex;
    this.title = title;
    this.narration = narration;
    this.durationSeconds = durationSeconds;
  }

  public static Scene rehydrate(
      Long id,
      long rowVersion,
      Long chapterId,
      int orderIndex,
      String title,
      String narration,
      Integer durationSeconds) {
    return new Scene(id, rowVersion, chapterId, orderIndex, title, narration, durationSeconds);
  }

  public Long getChapterId() {
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
}
