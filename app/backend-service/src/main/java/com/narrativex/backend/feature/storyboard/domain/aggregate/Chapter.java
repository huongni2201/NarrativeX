package com.narrativex.backend.feature.storyboard.domain.aggregate;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import java.util.Objects;
import java.util.regex.Pattern;

/** Storyboard chapter aggregate tied to a story-version snapshot. */
public final class Chapter extends AggregateRoot {
  private static final Pattern SHA_256_HEX = Pattern.compile("[0-9a-f]{64}");
  private static final String EMPTY_SOURCE_SHA_256 =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  private final Long storyVersionId;
  private int orderIndex;
  private String title;
  private String sourceText;
  private String sourceHash;

  /** Convenience constructor for an empty draft Chapter. */
  public Chapter(Long storyVersionId, int orderIndex, String title) {
    this(storyVersionId, orderIndex, title, "", EMPTY_SOURCE_SHA_256);
  }

  public Chapter(
      Long storyVersionId, int orderIndex, String title, String sourceText, String sourceHash) {
    this(null, 0L, storyVersionId, orderIndex, title, sourceText, sourceHash);
  }

  private Chapter(
      Long id,
      long rowVersion,
      Long storyVersionId,
      int orderIndex,
      String title,
      String sourceText,
      String sourceHash) {
    super(id, rowVersion);
    this.storyVersionId = positiveId(storyVersionId, "storyVersionId");
    this.orderIndex = validOrderIndex(orderIndex);
    this.title = requiredTitle(title);
    this.sourceText = Objects.requireNonNull(sourceText, "sourceText");
    this.sourceHash = requiredSourceHash(sourceHash);
  }

  /** Backward-compatible rehydration for legacy empty draft fixtures. */
  public static Chapter rehydrate(
      Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
    return new Chapter(
        id, rowVersion, storyVersionId, orderIndex, title, "", EMPTY_SOURCE_SHA_256);
  }

  public static Chapter rehydrate(
      Long id,
      long rowVersion,
      Long storyVersionId,
      int orderIndex,
      String title,
      String sourceText,
      String sourceHash) {
    return new Chapter(
        id, rowVersion, storyVersionId, orderIndex, title, sourceText, sourceHash);
  }

  /** Rename this chapter while preserving the chapter identity and story-version boundary. */
  public void rename(String newTitle) {
    title = requiredTitle(newTitle);
  }

  /** Replace persisted Chapter source using a server-computed fingerprint. */
  public void updateSource(String newSourceText, String newSourceHash) {
    sourceText = Objects.requireNonNull(newSourceText, "sourceText");
    sourceHash = requiredSourceHash(newSourceHash);
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

  public String getSourceText() {
    return sourceText;
  }

  public String getSourceHash() {
    return sourceHash;
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

  private static String requiredSourceHash(String value) {
    if (value == null || !SHA_256_HEX.matcher(value).matches()) {
      throw new IllegalArgumentException("sourceHash must be a lowercase SHA-256 hex value");
    }
    return value;
  }
}
