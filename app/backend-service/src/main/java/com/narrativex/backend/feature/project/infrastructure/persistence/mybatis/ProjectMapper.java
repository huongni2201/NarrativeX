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

  ProjectRow findOwnedById(@Param("projectId") UUID projectId, @Param("ownerId") String ownerId);

  ProjectRow findOwnedByIdForUpdate(
      @Param("projectId") UUID projectId, @Param("ownerId") String ownerId);

  List<ProjectRow> findActiveFirstPage(@Param("ownerId") String ownerId, @Param("limit") int limit);

  List<ProjectRow> findActiveAfter(
      @Param("ownerId") String ownerId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") UUID id,
      @Param("limit") int limit);
}
