package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProjectRenderInputSnapshotMapper extends NarrativeXMyBatisMapper {
  int insertHeader(
      @Param("generationJobId") UUID generationJobId,
      @Param("timeline") ProductionTimelineView timeline,
      @Param("resolution") String resolution,
      @Param("format") String format,
      @Param("assignedLocalDeviceId") UUID assignedLocalDeviceId,
      @Param("chapterCount") int chapterCount,
      @Param("beatCount") int beatCount);

  int insertChapter(
      @Param("generationJobId") UUID generationJobId,
      @Param("chapter") ProductionTimelineView.Chapter chapter);

  int insertBeat(
      @Param("generationJobId") UUID generationJobId,
      @Param("beat") ProductionTimelineView.Beat beat);
}
