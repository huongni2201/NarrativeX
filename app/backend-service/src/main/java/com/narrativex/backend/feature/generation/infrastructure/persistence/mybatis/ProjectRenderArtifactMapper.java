package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProjectRenderArtifactMapper extends NarrativeXMyBatisMapper {
  ProjectRenderArtifactRow findByJobId(
      @Param("projectId") UUID projectId,
      @Param("jobId") UUID jobId,
      @Param("ownerId") String ownerId);
}
