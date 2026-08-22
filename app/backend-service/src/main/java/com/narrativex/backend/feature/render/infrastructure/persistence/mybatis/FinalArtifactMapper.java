package com.narrativex.backend.feature.render.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface FinalArtifactMapper extends NarrativeXMyBatisMapper {
  FinalArtifactRow findOwned(
      @Param("artifactId") Long artifactId, @Param("ownerId") String ownerId);
}
