package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface ChapterMapper extends NarrativeXMyBatisMapper {
  Long insert(ChapterRow row);

  int update(ChapterRow row);

  ChapterRow findById(@Param("id") Long id);

  List<ChapterRow> findAllByStoryVersionId(@Param("storyVersionId") Long storyVersionId);

  List<ChapterRow> findFirstPageByStoryVersionId(
      @Param("storyVersionId") Long storyVersionId, @Param("limit") int limit);

  List<ChapterRow> findAfterByStoryVersionId(
      @Param("storyVersionId") Long storyVersionId,
      @Param("orderIndex") int orderIndex,
      @Param("id") Long id,
      @Param("limit") int limit);

  boolean existsByStoryVersionIdAndOrderIndex(
      @Param("storyVersionId") Long storyVersionId, @Param("orderIndex") int orderIndex);

  int findMaxOrderIndexByStoryVersionId(@Param("storyVersionId") Long storyVersionId);
}
