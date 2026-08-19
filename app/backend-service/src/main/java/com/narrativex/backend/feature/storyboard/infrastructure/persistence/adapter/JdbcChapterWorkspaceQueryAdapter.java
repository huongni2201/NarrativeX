package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterWorkspaceReadRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** PostgreSQL read adapter for the Chapter Workspace projection. */
@Component
@RequiredArgsConstructor
public class JdbcChapterWorkspaceQueryAdapter implements ChapterWorkspaceReadRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public Snapshot get(Long projectId, Long chapterId) {
    AggregateRow aggregate = loadAggregate(projectId, chapterId);
    return new Snapshot(
        aggregate.projectName(),
        loadPreviewScenes(chapterId),
        aggregate.sceneCount(),
        aggregate.visualBeatCount(),
        aggregate.estimatedDurationSeconds(),
        new Analysis(
            aggregate.analysisStatus(),
            aggregate.analysisSourceHash(),
            aggregate.analysisCompletedAt()));
  }

  private AggregateRow loadAggregate(Long projectId, Long chapterId) {
    return jdbcTemplate
        .query(
            """
            WITH scene_stats AS (
                SELECT COUNT(*)::int AS scene_count,
                       COALESCE(SUM(duration_seconds), 0)::bigint AS duration_seconds
                  FROM scenes
                 WHERE chapter_id = ? AND status <> 'OUTDATED'
            ),
            beat_stats AS (
                SELECT COUNT(vb.id)::int AS visual_beat_count
                  FROM visual_beats vb
                  JOIN scenes s ON s.id = vb.scene_id
                 WHERE s.chapter_id = ? AND s.status <> 'OUTDATED'
            ),
            latest_analysis AS (
                SELECT status,
                       source_hash,
                       CASE WHEN status = 'COMPLETED' THEN updated_at ELSE NULL END AS completed_at
                  FROM generation_jobs
                 WHERE chapter_id = ? AND job_type = 'CHAPTER_ANALYZE'
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
            )
            SELECT p.name AS project_name,
                   ss.scene_count,
                   bs.visual_beat_count,
                   ss.duration_seconds,
                   la.status AS analysis_status,
                   la.source_hash AS analysis_source_hash,
                   la.completed_at AS analysis_completed_at
              FROM projects p
              CROSS JOIN scene_stats ss
              CROSS JOIN beat_stats bs
              LEFT JOIN latest_analysis la ON TRUE
             WHERE p.id = ?
            """,
            (rs, rowNum) -> mapAggregate(rs),
            chapterId,
            chapterId,
            chapterId,
            projectId)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

  private List<PreviewScene> loadPreviewScenes(Long chapterId) {
    return jdbcTemplate.query(
        """
        SELECT s.id, s.order_index, s.title, s.duration_seconds, s.status,
               COUNT(vb.id)::int AS visual_beat_count
          FROM scenes s
          LEFT JOIN visual_beats vb ON vb.scene_id = s.id
         WHERE s.chapter_id = ? AND s.status <> 'OUTDATED'
         GROUP BY s.id, s.order_index, s.title, s.duration_seconds, s.status
         ORDER BY s.order_index ASC, s.id ASC
         LIMIT 4
        """,
        (rs, rowNum) -> mapPreviewScene(rs),
        chapterId);
  }

  private static AggregateRow mapAggregate(ResultSet rs) throws SQLException {
    return new AggregateRow(
        rs.getString("project_name"),
        rs.getInt("scene_count"),
        rs.getInt("visual_beat_count"),
        rs.getLong("duration_seconds"),
        rs.getString("analysis_status"),
        rs.getString("analysis_source_hash"),
        toInstant(rs.getTimestamp("analysis_completed_at")));
  }

  private static PreviewScene mapPreviewScene(ResultSet rs) throws SQLException {
    int duration = rs.getInt("duration_seconds");
    Integer durationSeconds = rs.wasNull() ? null : duration;
    return new PreviewScene(
        rs.getLong("id"),
        rs.getInt("order_index"),
        rs.getString("title"),
        durationSeconds,
        rs.getString("status"),
        rs.getInt("visual_beat_count"),
        null);
  }

  private static Instant toInstant(Timestamp value) {
    return value == null ? null : value.toInstant();
  }

  private record AggregateRow(
      String projectName,
      int sceneCount,
      int visualBeatCount,
      long estimatedDurationSeconds,
      String analysisStatus,
      String analysisSourceHash,
      Instant analysisCompletedAt) {}
}
