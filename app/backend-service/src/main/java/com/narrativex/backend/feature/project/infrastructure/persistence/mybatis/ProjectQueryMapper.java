package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProjectQueryMapper extends NarrativeXMyBatisMapper {
  List<ProjectAssetRow> findActiveAssetsFirstPage(
      @Param("projectId") UUID projectId, @Param("limit") int limit);

  List<ProjectAssetRow> findActiveAssetsAfter(
      @Param("projectId") UUID projectId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") UUID id,
      @Param("limit") int limit);
}
