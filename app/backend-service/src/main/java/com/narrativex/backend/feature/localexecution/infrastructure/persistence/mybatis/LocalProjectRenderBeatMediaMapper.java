package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface LocalProjectRenderBeatMediaMapper extends NarrativeXMyBatisMapper {
  List<LocalProjectRenderBeatMediaRow> listBeatMedia(
      @Param("generationJobId") UUID generationJobId);
}
