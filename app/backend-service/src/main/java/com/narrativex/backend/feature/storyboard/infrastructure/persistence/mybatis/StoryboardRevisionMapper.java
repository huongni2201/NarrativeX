package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface StoryboardRevisionMapper extends NarrativeXMyBatisMapper {
  StoryboardRevisionRow current(@Param("chapterId") UUID chapterId);

  int lockChapter(@Param("chapterId") UUID chapterId);

  UUID createDraft(
      @Param("chapterId") UUID chapterId,
      @Param("sourceHash") String sourceHash,
      @Param("sourceRowVersion") long sourceRowVersion,
      @Param("contentVariantId") Long contentVariantId);
}
