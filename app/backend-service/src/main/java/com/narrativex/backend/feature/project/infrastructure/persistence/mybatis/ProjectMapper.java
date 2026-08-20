package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface ProjectMapper extends NarrativeXMyBatisMapper {
  Long insert(ProjectRow row);

  int update(ProjectRow row);

  ProjectRow findById(@Param("id") Long id);

  ProjectRow findOwnedById(@Param("projectId") Long projectId, @Param("ownerId") String ownerId);

  ProjectRow findOwnedByIdForUpdate(
      @Param("projectId") Long projectId, @Param("ownerId") String ownerId);

  List<ProjectRow> findActiveFirstPage(@Param("ownerId") String ownerId, @Param("limit") int limit);

  List<ProjectRow> findActiveAfter(
      @Param("ownerId") String ownerId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") Long id,
      @Param("limit") int limit);
}
