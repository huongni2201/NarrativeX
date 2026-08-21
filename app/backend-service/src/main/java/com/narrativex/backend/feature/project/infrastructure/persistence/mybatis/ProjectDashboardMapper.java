package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface ProjectDashboardMapper extends NarrativeXMyBatisMapper {
  List<ProjectDashboardRow> findDashboardPage(
      @Param("userId") String userId,
      @Param("status") String status,
      @Param("query") String query,
      @Param("sort") String sort,
      @Param("offset") int offset,
      @Param("limit") int limit);

  ProjectDashboardCountsRow findDashboardCounts(
      @Param("userId") String userId, @Param("query") String query);

  int addFavorite(@Param("userId") String userId, @Param("projectId") Long projectId);

  int removeFavorite(@Param("userId") String userId, @Param("projectId") Long projectId);
}
