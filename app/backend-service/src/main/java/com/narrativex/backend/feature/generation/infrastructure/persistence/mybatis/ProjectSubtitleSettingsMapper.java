package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProjectSubtitleSettingsMapper extends NarrativeXMyBatisMapper {
  String find(@Param("projectId") UUID projectId);

  int upsert(@Param("projectId") UUID projectId, @Param("settingsJson") String settingsJson);
}
