package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

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
    String projectName =
        jdbcTemplate.queryForObject(
            "select name from projects where id = ?", String.class, projectId);

    List<PreviewScene> previewScenes =
        jdbcTemplate.query(
            """
            select s.id, s.order_index, s.title, s.duration_seconds, s.status,
                   count(vb.id) as visual_beat_count
              from scenes s
              left join visual_beats vb on vb.scene_id = s.id
             where s.chapter_id = ? and s.status <> 'OUTDATED'
             group by s.id, s.order_index, s.title, s.duration_seconds, s.status
             order by s.order_index asc, s.id asc
             limit 4
            """,
            (rs, rowNum) -> mapPreviewScene(rs),
            chapterId);

    Integer sceneCount =
        jdbcTemplate.queryForObject(
            "select count(*) from scenes where chapter_id = ? and status <> 'OUTDATED'",
            Integer.class,
            chapterId);
    Integer visualBeatCount =
        jdbcTemplate.queryForObject(
            """
            select count(vb.id)
              from visual_beats vb
              join scenes s on s.id = vb.scene_id
             where s.chapter_id = ? and s.status <> 'OUTDATED'
            """,
            Integer.class,
            chapterId);
    Long estimatedDurationSeconds =
        jdbcTemplate.queryForObject(
            "select coalesce(sum(duration_seconds), 0) from scenes where chapter_id = ? and status <> 'OUTDATED'",
            Long.class,
            chapterId);

    return new Snapshot(
        projectName,
        previewScenes,
        sceneCount == null ? 0 : sceneCount,
        visualBeatCount == null ? 0 : visualBeatCount,
        estimatedDurationSeconds == null ? 0 : estimatedDurationSeconds,
        latestAnalysis(chapterId));
  }

  private Analysis latestAnalysis(Long chapterId) {
    List<Analysis> results =
        jdbcTemplate.query(
            """
            select status, source_hash,
                   case when status = 'COMPLETED' then updated_at else null end as completed_at
              from generation_jobs
             where chapter_id = ? and job_type = 'CHAPTER_ANALYZE'
             order by created_at desc, id desc
             limit 1
            """,
            (rs, rowNum) ->
                new Analysis(
                    rs.getString("status"),
                    rs.getString("source_hash"),
                    toInstant(rs.getTimestamp("completed_at"))),
            chapterId);
    return results.isEmpty() ? new Analysis(null, null, null) : results.getFirst();
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
}
