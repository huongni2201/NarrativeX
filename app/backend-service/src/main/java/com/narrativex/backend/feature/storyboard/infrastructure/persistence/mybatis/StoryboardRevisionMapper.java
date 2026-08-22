package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface StoryboardRevisionMapper extends NarrativeXMyBatisMapper {
  StoryboardRevisionRow current(@Param("chapterId") Long chapterId);

  int lockChapter(@Param("chapterId") Long chapterId);

  Long createDraft(
      @Param("chapterId") Long chapterId,
      @Param("sourceHash") String sourceHash,
      @Param("sourceRowVersion") long sourceRowVersion,
      @Param("contentVariantId") Long contentVariantId);
}
