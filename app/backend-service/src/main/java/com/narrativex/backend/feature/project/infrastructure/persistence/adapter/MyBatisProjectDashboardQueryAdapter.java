package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.project.application.port.out.ProjectDashboardQueryRepository;
import com.narrativex.backend.feature.project.application.port.out.ProjectFavoriteRepository;
import com.narrativex.backend.feature.project.application.query.ProjectDashboardView;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardCountsRow;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardRow;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisProjectDashboardQueryAdapter
    implements ProjectDashboardQueryRepository, ProjectFavoriteRepository {
  private final ProjectDashboardMapper mapper;

  @Override
  public List<ProjectDashboardView.Item> findPage(
      String userId, String status, String query, String sort, int offset, int limit) {
    return mapper.findDashboardPage(userId, status, query, sort, offset, limit).stream()
        .map(MyBatisProjectDashboardQueryAdapter::toItem)
        .toList();
  }

  @Override
  public ProjectDashboardView.Counts findCounts(String userId, String query) {
    return toCounts(mapper.findDashboardCounts(userId, query));
  }

  @Override
  public void add(String userId, Long projectId) {
    mapper.addFavorite(userId, projectId);
  }

  @Override
  public void remove(String userId, Long projectId) {
    mapper.removeFavorite(userId, projectId);
  }

  private static ProjectDashboardView.Item toItem(ProjectDashboardRow row) {
    return new ProjectDashboardView.Item(
        row.id(),
        row.name(),
        row.description(),
        row.coverImageUrl(),
        row.status(),
        row.createdAt(),
        row.updatedAt(),
        row.starred(),
        row.totalChapters(),
        row.totalScenes(),
        row.estimatedDurationSeconds());
  }

  private static ProjectDashboardView.Counts toCounts(ProjectDashboardCountsRow row) {
    return new ProjectDashboardView.Counts(row.allCount(), row.activeCount(), row.draftCount());
  }
}
