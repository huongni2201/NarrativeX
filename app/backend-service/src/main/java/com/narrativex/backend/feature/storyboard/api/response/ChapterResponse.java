package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.time.Instant;
import java.util.UUID;

public record ChapterResponse(
    UUID id,
    UUID storyVersionId,
    int orderIndex,
    String title,
    String sourceText,
    String sourceHash,
    long rowVersion,
    Instant createdAt,
    Instant updatedAt) {
  public ChapterResponse(
      UUID id,
      UUID storyVersionId,
      int orderIndex,
      String title,
      String sourceText,
      String sourceHash,
      long rowVersion) {
    this(
        id,
        storyVersionId,
        orderIndex,
        title,
        sourceText,
        sourceHash,
        rowVersion,
        Instant.EPOCH,
        Instant.EPOCH);
  }

  public static ChapterResponse from(Chapter chapter) {
    return new ChapterResponse(
        chapter.getId(),
        chapter.getStoryVersionId(),
        chapter.getOrderIndex(),
        chapter.getTitle(),
        chapter.getSourceText(),
        chapter.getSourceHash(),
        chapter.getRowVersion(),
        chapter.getCreatedAt(),
        chapter.getUpdatedAt());
  }
}
