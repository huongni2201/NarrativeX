package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface VisualPromptContinuityMapper extends NarrativeXMyBatisMapper {
  VisualPromptContinuityRow findForBeat(
      @Param("projectId") UUID projectId, @Param("visualBeatId") UUID visualBeatId);

  List<VisualPromptContinuityRow> findForBeats(
      @Param("projectId") UUID projectId, @Param("visualBeatIds") List<UUID> visualBeatIds);
}
