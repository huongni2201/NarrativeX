package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.UUID;

public record ChapterResponse(
    UUID id,
    UUID storyVersionId,
    int orderIndex,
    String title,
    String sourceText,
    String sourceHash,
    long rowVersion) {
  public static ChapterResponse from(Chapter chapter) {
    return new ChapterResponse(
        chapter.getId(),
        chapter.getStoryVersionId(),
        chapter.getOrderIndex(),
        chapter.getTitle(),
        chapter.getSourceText(),
        chapter.getSourceHash(),
        chapter.getRowVersion());
  }
}
