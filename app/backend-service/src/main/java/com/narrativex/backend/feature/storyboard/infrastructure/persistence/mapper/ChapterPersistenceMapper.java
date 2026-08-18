package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mapper;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.ChapterJpaEntity;

public final class ChapterPersistenceMapper {
  private ChapterPersistenceMapper() {}

  public static Chapter toDomain(ChapterJpaEntity entity) {
    return Chapter.rehydrate(
        entity.getId(),
        entity.getRowVersion(),
        entity.getStoryVersionId(),
        entity.getOrderIndex(),
        entity.getTitle(),
        entity.getSourceText(),
        entity.getSourceHash());
  }

  public static void apply(Chapter chapter, ChapterJpaEntity entity) {
    entity.setStoryVersionId(chapter.getStoryVersionId());
    entity.setOrderIndex(chapter.getOrderIndex());
    entity.setTitle(chapter.getTitle());
    entity.setSourceText(chapter.getSourceText());
    entity.setSourceHash(chapter.getSourceHash());
  }
}
