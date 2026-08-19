package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.generation.application.port.out.JobHistoryQueryRepository;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcJobHistoryQueryAdapter implements JobHistoryQueryRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public List<JobHistoryView> list(String userId, CursorKey cursor, int fetchLimit) {
    if (cursor == null) {
      return jdbcTemplate.query(
          baseSql() + " ORDER BY j.created_at DESC, j.id DESC LIMIT ?",
          (rs, rowNum) -> map(rs),
          userId,
          fetchLimit);
    }
    return jdbcTemplate.query(
        baseSql()
            + " AND (j.created_at < ? OR (j.created_at = ? AND j.id < ?))"
            + " ORDER BY j.created_at DESC, j.id DESC LIMIT ?",
        (rs, rowNum) -> map(rs),
        userId,
        Timestamp.from(cursor.updatedAt()),
        Timestamp.from(cursor.updatedAt()),
        cursor.id(),
        fetchLimit);
  }

  private static String baseSql() {
    return """
        SELECT j.id,
               j.job_id,
               j.project_id,
               p.name AS project_name,
               j.job_type,
               j.status,
               j.progress,
               j.current_step,
               j.error_code,
               j.created_at,
               CASE WHEN j.status IN ('COMPLETED', 'FAILED', 'CANCELED') THEN j.updated_at END AS completed_at
          FROM generation_jobs j
          JOIN projects p ON p.id = j.project_id
         WHERE j.requested_by_user_id = ?
        """;
  }

  private static JobHistoryView map(ResultSet rs) throws SQLException {
    return new JobHistoryView(
        rs.getLong("id"),
        rs.getString("job_id"),
        rs.getLong("project_id"),
        rs.getString("project_name"),
        rs.getString("job_type"),
        rs.getString("status"),
        rs.getInt("progress"),
        rs.getString("current_step"),
        rs.getString("error_code"),
        instant(rs, "created_at"),
        instant(rs, "completed_at"));
  }

  private static Instant instant(ResultSet rs, String column) throws SQLException {
    Timestamp timestamp = rs.getTimestamp(column);
    return timestamp == null ? null : timestamp.toInstant();
  }
}
