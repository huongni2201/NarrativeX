package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;

public record ChapterResponse(
    Long id,
    Long storyVersionId,
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
