package com.narrativex.backend.feature.storyboard.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;

/** Storyboard chapter aggregate tied to a story-version snapshot. */
public final class Chapter extends AggregateRoot {
  private final Long storyVersionId;
  private int orderIndex;
  private String title;

  public Chapter(Long storyVersionId, int orderIndex, String title) {
    this(null, 0L, storyVersionId, orderIndex, title);
  }

  private Chapter(Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
    super(id, rowVersion);
    this.storyVersionId = positiveId(storyVersionId, "storyVersionId");
    this.orderIndex = validOrderIndex(orderIndex);
    this.title = requiredTitle(title);
  }

  public static Chapter rehydrate(
      Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
    return new Chapter(id, rowVersion, storyVersionId, orderIndex, title);
  }

  /** Rename this chapter while preserving the chapter identity and story-version boundary. */
  public void rename(String newTitle) {
    title = requiredTitle(newTitle);
  }

  /** Change chapter ordering. Cross-chapter uniqueness is enforced by the repository/database. */
  public void reorder(int newOrderIndex) {
    orderIndex = validOrderIndex(newOrderIndex);
  }

  public Long getStoryVersionId() {
    return storyVersionId;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public String getTitle() {
    return title;
  }

  private static Long positiveId(Long value, String field) {
    if (value == null || value <= 0) {
      throw new IllegalArgumentException(field + " must be positive");
    }
    return value;
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
}
