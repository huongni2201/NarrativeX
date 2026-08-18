package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;

public record ChapterSummaryResponse(
    Long id,
    Long storyVersionId,
    int orderIndex,
    String title,
    String sourceHash,
    long rowVersion) {
  public static ChapterSummaryResponse from(Chapter chapter) {
    return new ChapterSummaryResponse(
        chapter.getId(),
        chapter.getStoryVersionId(),
        chapter.getOrderIndex(),
        chapter.getTitle(),
        chapter.getSourceHash(),
        chapter.getRowVersion());
  }
}
