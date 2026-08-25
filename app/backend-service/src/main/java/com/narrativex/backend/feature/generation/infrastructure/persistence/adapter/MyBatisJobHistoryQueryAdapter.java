package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.pagination.UuidCursorKey;
import com.narrativex.backend.feature.generation.application.port.out.JobHistoryQueryRepository;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.JobHistoryMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.JobHistoryRow;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisJobHistoryQueryAdapter implements JobHistoryQueryRepository {
  private final JobHistoryMapper mapper;

  @Override
  public List<JobHistoryView> list(String userId, UuidCursorKey cursor, int fetchLimit) {
    return mapper
        .list(
            userId,
            cursor == null ? null : cursor.updatedAt(),
            cursor == null ? null : cursor.id(),
            fetchLimit)
        .stream()
        .map(MyBatisJobHistoryQueryAdapter::map)
        .toList();
  }

  private static JobHistoryView map(JobHistoryRow row) {
    return new JobHistoryView(
        row.getId(),
        row.getJobId(),
        row.getProjectId(),
        row.getProjectName(),
        row.getJobType(),
        row.getStatus(),
        row.getProgress(),
        row.getCurrentStep(),
        row.getErrorCode(),
        row.getCreatedAt(),
        row.getCompletedAt());
  }
}
