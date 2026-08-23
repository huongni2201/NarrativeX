package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface StoryVersionMapper extends NarrativeXMyBatisMapper {
  int maxVersion(@Param("projectId") UUID projectId);

  StoryVersionRow findByIdAndProject(@Param("id") UUID id, @Param("projectId") UUID projectId);

  StoryVersionRow findActive(@Param("projectId") UUID projectId, @Param("status") String status);

  StoryVersionRow findLatest(@Param("projectId") UUID projectId);

  StoryVersionRow findById(@Param("id") UUID id);

  UUID insert(StoryVersionRow row);

  int update(StoryVersionRow row);
}
