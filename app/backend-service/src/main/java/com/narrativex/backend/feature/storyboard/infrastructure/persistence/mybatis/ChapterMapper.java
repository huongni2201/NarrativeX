package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterMapper extends NarrativeXMyBatisMapper {
  UUID insert(ChapterRow row);

  int update(ChapterRow row);

  int clearChapterCreationIdempotency(@Param("chapterId") UUID chapterId);

  int deleteById(@Param("id") UUID id);

  ChapterRow findById(@Param("id") UUID id);

  List<ChapterRow> findAllByStoryVersionId(@Param("storyVersionId") UUID storyVersionId);

  List<ChapterRow> findFirstPageByStoryVersionId(
      @Param("storyVersionId") UUID storyVersionId, @Param("limit") int limit);

  List<ChapterRow> findAfterByStoryVersionId(
      @Param("storyVersionId") UUID storyVersionId,
      @Param("orderIndex") int orderIndex,
      @Param("id") UUID id,
      @Param("limit") int limit);

  boolean existsByStoryVersionIdAndOrderIndex(
      @Param("storyVersionId") UUID storyVersionId, @Param("orderIndex") int orderIndex);

  int findMaxOrderIndexByStoryVersionId(@Param("storyVersionId") UUID storyVersionId);
}
