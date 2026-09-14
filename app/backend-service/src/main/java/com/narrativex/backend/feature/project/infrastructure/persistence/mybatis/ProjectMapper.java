package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProjectMapper extends NarrativeXMyBatisMapper {
  UUID insert(ProjectRow row);

  int update(ProjectRow row);

  ProjectRow findById(@Param("id") UUID id);

  ProjectRow findByIdActive(@Param("projectId") UUID projectId);

  ProjectRow findByIdActiveForUpdate(@Param("projectId") UUID projectId);

  List<ProjectRow> findActiveFirstPage(@Param("limit") int limit);

  List<ProjectRow> findActiveAfter(
      @Param("updatedAt") Instant updatedAt,
      @Param("id") UUID id,
      @Param("limit") int limit);
}
