package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.application.query.ProjectDashboardView;
import java.util.List;

public interface ProjectDashboardQueryRepository {
  List<ProjectDashboardView.Item> findPage(
      String userId, String status, String query, String sort, int offset, int limit);

  ProjectDashboardView.Counts findCounts(String userId, String query);
}
