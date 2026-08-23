package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface ChapterAnalysisSnapshotMapper extends NarrativeXMyBatisMapper {
  ChapterAnalysisSnapshotRow findOwned(
      @Param("projectId") Long projectId,
      @Param("chapterId") Long chapterId,
      @Param("userId") String userId,
      @Param("contentVariantId") Long contentVariantId);

  boolean existsOwnedChapter(
      @Param("projectId") Long projectId,
      @Param("chapterId") Long chapterId,
      @Param("userId") String userId);

  boolean existsReadyOriginalVariant(
      @Param("projectId") Long projectId, @Param("chapterId") Long chapterId);
}
