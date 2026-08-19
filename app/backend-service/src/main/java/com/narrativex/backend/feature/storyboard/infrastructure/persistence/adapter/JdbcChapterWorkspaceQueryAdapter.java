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
        aggregate.storyboardSourceHash(),
        aggregate.hasApprovedOutput(),
        new Analysis(aggregate.analysisStatus(), aggregate.analysisSourceHash(), aggregate.analysisCompletedAt()));
  }

  private AggregateRow loadAggregate(Long projectId, Long chapterId) {
    return jdbcTemplate
        .query(
            """
            WITH current_revision AS (
                SELECT c.current_storyboard_revision_id AS revision_id,
                       sr.source_hash AS storyboard_source_hash
                  FROM chapters c
                  LEFT JOIN storyboard_revisions sr ON sr.id = c.current_storyboard_revision_id
                 WHERE c.id = ?
            ),
            scene_stats AS (
                SELECT COUNT(s.id)::int AS scene_count,
                       COALESCE(SUM(s.duration_seconds), 0)::bigint AS duration_seconds
                  FROM current_revision cr
                  LEFT JOIN scenes s ON s.storyboard_revision_id = cr.revision_id
                                    AND s.status <> 'OUTDATED'
            ),
            beat_stats AS (
                SELECT COUNT(vb.id)::int AS visual_beat_count
                  FROM current_revision cr
                  LEFT JOIN scenes s ON s.storyboard_revision_id = cr.revision_id
                                    AND s.status <> 'OUTDATED'
                  LEFT JOIN visual_beats vb ON vb.scene_id = s.id
            ),
            approval_state AS (
                SELECT EXISTS(
                    SELECT 1
                      FROM current_revision cr
                      JOIN scenes s ON s.storyboard_revision_id = cr.revision_id
                      LEFT JOIN visual_beats vb ON vb.scene_id = s.id
                     WHERE s.status = 'APPROVED' OR vb.review_status = 'APPROVED'
                ) AS has_approved_output
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
                   cr.storyboard_source_hash,
                   aps.has_approved_output,
                   la.status AS analysis_status,
                   la.source_hash AS analysis_source_hash,
                   la.completed_at AS analysis_completed_at
              FROM projects p
              CROSS JOIN current_revision cr
              CROSS JOIN scene_stats ss
              CROSS JOIN beat_stats bs
              CROSS JOIN approval_state aps
              LEFT JOIN latest_analysis la ON TRUE
             WHERE p.id = ?
            """,
            (rs, rowNum) -> mapAggregate(rs),
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
          FROM chapters c
          JOIN scenes s ON s.storyboard_revision_id = c.current_storyboard_revision_id
          LEFT JOIN visual_beats vb ON vb.scene_id = s.id
         WHERE c.id = ? AND s.status <> 'OUTDATED'
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
        rs.getString("storyboard_source_hash"),
        rs.getBoolean("has_approved_output"),
        rs.getString("analysis_status"),
        rs.getString("analysis_source_hash"),
        toInstant(rs.getTimestamp("analysis_completed_at")));
  }

  private static PreviewScene mapPreviewScene(ResultSet rs) throws SQLException {
    int duration = rs.getInt("duration_seconds");
    Integer durationSeconds = rs.wasNull() ? null : duration;
    return new PreviewScene(
        rs.getLong("id"), rs.getInt("order_index"), rs.getString("title"), durationSeconds,
        rs.getString("status"), rs.getInt("visual_beat_count"), null);
  }

  private static Instant toInstant(Timestamp value) {
    return value == null ? null : value.toInstant();
  }

  private record AggregateRow(
      String projectName,
      int sceneCount,
      int visualBeatCount,
      long estimatedDurationSeconds,
      String storyboardSourceHash,
      boolean hasApprovedOutput,
      String analysisStatus,
      String analysisSourceHash,
      Instant analysisCompletedAt) {}
}
