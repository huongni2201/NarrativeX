package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.out.ProjectOverviewQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** PostgreSQL projection for the Project Overview screen. */
@Component
@RequiredArgsConstructor
public class JdbcProjectOverviewQueryAdapter implements ProjectOverviewQueryRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public ProjectOverviewView get(Long projectId) {
    ProjectRow project =
        jdbcTemplate
            .query(
                """
                SELECT p.id,
                       p.name,
                       COALESCE(NULLIF(p.description, ''), LEFT(sv.content, 320)) AS description,
                       p.cover_image_url,
                       p.status,
                       p.created_at,
                       p.updated_at,
                       sv.id AS story_version_id,
                       COALESCE(appr_vis.cnt, 0) AS approved_visuals_count,
                       COALESCE(proc_jobs.cnt, 0) AS processing_jobs_count,
                       COALESCE(chars.cnt, 0) AS characters_count,
                       COALESCE(locs.cnt, 0) AS locations_count,
                       COALESCE(asts.cnt, 0) AS assets_count
                  FROM projects p
                  LEFT JOIN LATERAL (
                      SELECT id, content
                        FROM story_versions
                       WHERE project_id = p.id
                         AND status IN ('ACTIVE', 'DRAFT')
                       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
                                version_number DESC,
                                id DESC
                       LIMIT 1
                  ) sv ON TRUE
                  LEFT JOIN LATERAL (
                      SELECT COUNT(vb.id)::int AS cnt
                        FROM chapters c
                        JOIN scenes s ON s.chapter_id = c.id AND s.status = 'APPROVED'
                        JOIN visual_beats vb ON vb.scene_id = s.id
                       WHERE c.story_version_id = sv.id
                  ) appr_vis ON TRUE
                  LEFT JOIN LATERAL (
                      SELECT COUNT(*)::int AS cnt
                        FROM generation_jobs
                       WHERE project_id = p.id
                         AND status IN ('QUEUED', 'RUNNING', 'STALLED', 'PAUSED_COST_LIMIT')
                  ) proc_jobs ON TRUE
                  LEFT JOIN LATERAL (
                      SELECT COUNT(*)::int AS cnt
                        FROM project_characters
                       WHERE project_id = p.id
                         AND status = 'ACTIVE'
                  ) chars ON TRUE
                  LEFT JOIN LATERAL (
                      SELECT COUNT(*)::int AS cnt
                        FROM project_locations
                       WHERE project_id = p.id
                         AND status = 'ACTIVE'
                  ) locs ON TRUE
                  LEFT JOIN LATERAL (
                      SELECT COUNT(*)::int AS cnt
                        FROM project_assets
                       WHERE project_id = p.id
                         AND status = 'ACTIVE'
                  ) asts ON TRUE
                 WHERE p.id = ?
                """,
                (rs, rowNum) -> mapProject(rs),
                projectId)
            .stream()
            .findFirst()
            .orElseThrow(() -> new ResourceNotFoundException("Project was not found"));

    List<ProjectOverviewView.Chapter> chapters =
        project.storyVersionId() == null ? List.of() : loadChapters(project.storyVersionId());

    int totalChapters = chapters.size();
    int readyChapters =
        (int) chapters.stream().filter(chapter -> isReady(chapter.status())).count();
    int renderedChapters =
        (int) chapters.stream().filter(chapter -> "RENDERED".equals(chapter.status())).count();
    int totalScenes = chapters.stream().mapToInt(ProjectOverviewView.Chapter::sceneCount).sum();
    long estimatedDurationSeconds =
        chapters.stream().mapToLong(ProjectOverviewView.Chapter::durationSeconds).sum();
    int overallProgress = calculateProgress(chapters);

    return new ProjectOverviewView(
        project.id(),
        project.name(),
        project.description(),
        project.coverImageUrl(),
        project.status(),
        project.createdAt(),
        project.updatedAt(),
        new ProjectOverviewView.Metrics(
            totalChapters,
            readyChapters,
            renderedChapters,
            totalScenes,
            estimatedDurationSeconds,
            project.approvedVisualsCount(),
            project.processingJobsCount(),
            overallProgress),
        new ProjectOverviewView.Counts(
            project.charactersCount(),
            project.locationsCount(),
            project.assetsCount()),
        chapters);
  }

  private List<ProjectOverviewView.Chapter> loadChapters(Long storyVersionId) {
    return jdbcTemplate.query(
        """
        SELECT c.id,
               c.order_index,
               c.title,
               CASE
                 WHEN latest_job.status IN ('QUEUED', 'RUNNING', 'STALLED', 'PAUSED_COST_LIMIT')
                      AND latest_job.source_hash = c.source_hash
                   THEN 'ANALYZING'
                 WHEN latest_job.status = 'FAILED'
                      AND latest_job.source_hash = c.source_hash
                   THEN 'FAILED'
                 WHEN latest_job.status = 'COMPLETED'
                      AND latest_job.source_hash = c.source_hash
                   THEN 'ANALYZED'
                 WHEN c.status IN ('ANALYZED', 'GENERATING_VISUALS', 'VISUAL_REVIEW', 'VISUAL_READY',
                                   'GENERATING_AUDIO', 'AUDIO_READY', 'RENDERING', 'RENDERED', 'FAILED')
                   THEN c.status
                 WHEN c.status = 'READY' THEN 'ANALYZED'
                 ELSE 'DRAFT'
               END AS overview_status,
               CASE
                 WHEN (latest_job.status = 'COMPLETED' AND latest_job.source_hash = c.source_hash)
                      OR c.status = 'READY'
                      OR c.status IN ('ANALYZED', 'GENERATING_VISUALS', 'VISUAL_REVIEW', 'VISUAL_READY',
                                      'GENERATING_AUDIO', 'AUDIO_READY', 'RENDERING', 'RENDERED')
                   THEN COUNT(s.id)::int
                 ELSE 0
               END AS scene_count,
               CASE
                 WHEN (latest_job.status = 'COMPLETED' AND latest_job.source_hash = c.source_hash)
                      OR c.status = 'READY'
                      OR c.status IN ('ANALYZED', 'GENERATING_VISUALS', 'VISUAL_REVIEW', 'VISUAL_READY',
                                      'GENERATING_AUDIO', 'AUDIO_READY', 'RENDERING', 'RENDERED')
                   THEN CASE
                          WHEN COALESCE(SUM(s.duration_seconds), 0) > 0
                            THEN COALESCE(SUM(s.duration_seconds), 0)
                          ELSE COALESCE(c.estimated_duration_ms / 1000, 0)
                        END
                 ELSE 0
               END AS duration_seconds,
               c.updated_at
          FROM chapters c
          LEFT JOIN scenes s ON s.chapter_id = c.id
          LEFT JOIN LATERAL (
              SELECT status, source_hash
                FROM generation_jobs
               WHERE chapter_id = c.id
                 AND job_type = 'CHAPTER_ANALYZE'
               ORDER BY created_at DESC, id DESC
               LIMIT 1
          ) latest_job ON TRUE
         WHERE c.story_version_id = ?
         GROUP BY c.id, c.order_index, c.title, c.status, c.source_hash, c.estimated_duration_ms,
                  c.updated_at, latest_job.status, latest_job.source_hash
         ORDER BY c.order_index ASC, c.id ASC
        """,
        (rs, rowNum) ->
            new ProjectOverviewView.Chapter(
                rs.getLong("id"),
                rs.getInt("order_index"),
                rs.getString("title"),
                rs.getString("overview_status"),
                rs.getInt("scene_count"),
                rs.getLong("duration_seconds"),
                instant(rs, "updated_at")),
        storyVersionId);
  }

  private static int calculateProgress(List<ProjectOverviewView.Chapter> chapters) {
    if (chapters.isEmpty()) return 0;
    int total = chapters.stream().mapToInt(chapter -> statusProgress(chapter.status())).sum();
    int average = Math.round((float) total / chapters.size());
    return Math.max(0, Math.min(100, average));
  }

  private static int statusProgress(String status) {
    return switch (status) {
      case "ANALYZING" -> 20;
      case "ANALYZED" -> 35;
      case "GENERATING_VISUALS" -> 50;
      case "VISUAL_REVIEW" -> 65;
      case "VISUAL_READY" -> 75;
      case "GENERATING_AUDIO" -> 80;
      case "AUDIO_READY" -> 85;
      case "RENDERING" -> 90;
      case "RENDERED" -> 100;
      case "FAILED" -> 0;
      default -> 10;
    };
  }

  private static boolean isReady(String status) {
    return !"DRAFT".equals(status) && !"ANALYZING".equals(status) && !"FAILED".equals(status);
  }

  private static ProjectRow mapProject(ResultSet rs) throws SQLException {
    long storyVersionId = rs.getLong("story_version_id");
    boolean missingStoryVersion = rs.wasNull();
    return new ProjectRow(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getString("description"),
        rs.getString("cover_image_url"),
        rs.getString("status"),
        instant(rs, "created_at"),
        instant(rs, "updated_at"),
        missingStoryVersion ? null : storyVersionId,
        rs.getInt("approved_visuals_count"),
        rs.getInt("processing_jobs_count"),
        rs.getInt("characters_count"),
        rs.getInt("locations_count"),
        rs.getInt("assets_count"));
  }

  private static Instant instant(ResultSet rs, String column) throws SQLException {
    Timestamp timestamp = rs.getTimestamp(column);
    return timestamp == null ? null : timestamp.toInstant();
  }

  private record ProjectRow(
      Long id,
      String name,
      String description,
      String coverImageUrl,
      String status,
      Instant createdAt,
      Instant updatedAt,
      Long storyVersionId,
      int approvedVisualsCount,
      int processingJobsCount,
      int charactersCount,
      int locationsCount,
      int assetsCount) {}
}
