package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface StoryVersionMapper extends NarrativeXMyBatisMapper {
  int maxVersion(@Param("projectId") Long projectId);
  StoryVersionRow findByIdAndProject(@Param("id") Long id, @Param("projectId") Long projectId);
  StoryVersionRow findActive(@Param("projectId") Long projectId, @Param("status") String status);
  StoryVersionRow findLatest(@Param("projectId") Long projectId);
  StoryVersionRow findById(@Param("id") Long id);
  Long insert(StoryVersionRow row);
  int update(StoryVersionRow row);
}
