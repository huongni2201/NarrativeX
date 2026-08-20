package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface ProjectQueryMapper extends NarrativeXMyBatisMapper {
  ProjectOverviewRow findOverview(@Param("projectId") Long projectId);

  List<ProjectOverviewChapterRow> findOverviewChapters(
      @Param("storyVersionId") Long storyVersionId);

  List<ProjectLocationRow> findActiveLocationsFirstPage(
      @Param("projectId") Long projectId, @Param("limit") int limit);

  List<ProjectLocationRow> findActiveLocationsAfter(
      @Param("projectId") Long projectId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") Long id,
      @Param("limit") int limit);

  List<ProjectAssetRow> findActiveAssetsFirstPage(
      @Param("projectId") Long projectId, @Param("limit") int limit);

  List<ProjectAssetRow> findActiveAssetsAfter(
      @Param("projectId") Long projectId,
      @Param("updatedAt") Instant updatedAt,
      @Param("id") Long id,
      @Param("limit") int limit);
}
