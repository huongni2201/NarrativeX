package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProductionTimelineMapper extends NarrativeXMyBatisMapper {
  /** {@code chapterId == null} returns every chapter of the project's current story version. */
  List<ProductionTimelineChapterRow> findChapters(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  /** {@code chapterId == null} returns the beats of every chapter. */
  List<ProductionTimelineBeatRow> findBeats(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  default List<ProductionTimelineChapterRow> findChapters(UUID projectId) {
    return findChapters(projectId, null);
  }

  default List<ProductionTimelineBeatRow> findBeats(UUID projectId) {
    return findBeats(projectId, null);
  }

  /** True when any current beat of the project already has a shot (native video timeline). */
  boolean hasNativeShotBeats(@Param("projectId") UUID projectId);
}
