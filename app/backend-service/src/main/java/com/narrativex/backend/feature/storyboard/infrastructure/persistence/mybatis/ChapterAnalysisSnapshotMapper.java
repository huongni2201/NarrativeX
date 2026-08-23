package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterAnalysisSnapshotMapper extends NarrativeXMyBatisMapper {
  ChapterAnalysisSnapshotRow findOwned(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("userId") String userId,
      @Param("contentVariantId") UUID contentVariantId);

  boolean existsOwnedChapter(
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("userId") String userId);

  boolean existsReadyOriginalVariant(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);
}
