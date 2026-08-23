package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterWorkspaceMapper extends NarrativeXMyBatisMapper {
  ChapterWorkspaceAggregateRow aggregate(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  List<ChapterWorkspacePreviewRow> previewScenes(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);
}
