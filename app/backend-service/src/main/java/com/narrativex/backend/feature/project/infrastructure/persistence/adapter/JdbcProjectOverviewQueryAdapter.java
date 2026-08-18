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
                       sv.id AS story_version_id
                  FROM projects p
                  LEFT JOIN LATERAL (
                      SELECT id, content
                        FROM story_versions
                       WHERE project_id = p.id
                       ORDER BY version_number DESC, id DESC
                       LIMIT 1
                  ) sv ON TRUE
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
    int readyChapters = (int) chapters.stream().filter(chapter -> isReady(chapter.status())).count();
    int renderedChapters =
        (int) chapters.stream().filter(chapter -> "RENDERED".equals(chapter.status())).count();
    int totalScenes = chapters.stream().mapToInt(ProjectOverviewView.Chapter::sceneCount).sum();
    long estimatedDurationSeconds =
        chapters.stream().mapToLong(ProjectOverviewView.Chapter::durationSeconds).sum();
    int approvedVisuals = approvedVisuals(project.storyVersionId());
    int processingJobs = processingJobs(projectId);
    int overallProgress = calculateProgress(chapters);
    int characters = activeCharacterCount(projectId);

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
            approvedVisuals,
            processingJobs,
            overallProgress),
        // Location and Asset bounded contexts do not expose persisted project counts yet.
        new ProjectOverviewView.Counts(characters, 0, 0),
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
                   THEN 'ANALYZING'
                 WHEN latest_job.status = 'FAILED'
                   THEN 'FAILED'
                 WHEN c.status IN ('DRAFT', 'ANALYZING', 'ANALYZED', 'GENERATING_VISUALS',
                                   'VISUAL_REVIEW', 'VISUAL_READY', 'GENERATING_AUDIO',
                                   'AUDIO_READY', 'RENDERING', 'RENDERED', 'FAILED')
                   THEN c.status
                 WHEN c.status = 'READY' THEN 'ANALYZED'
                 WHEN COUNT(s.id) > 0 THEN 'ANALYZED'
                 ELSE 'DRAFT'
               END AS overview_status,
               COUNT(s.id)::int AS scene_count,
               CASE
                 WHEN COALESCE(SUM(s.duration_seconds), 0) > 0
                   THEN COALESCE(SUM(s.duration_seconds), 0)
                 ELSE COALESCE(c.estimated_duration_ms / 1000, 0)
               END AS duration_seconds,
               c.updated_at
          FROM chapters c
          LEFT JOIN scenes s ON s.chapter_id = c.id
          LEFT JOIN LATERAL (
              SELECT status
                FROM generation_jobs
               WHERE chapter_id = c.id
                 AND job_type = 'CHAPTER_ANALYZE'
               ORDER BY created_at DESC, id DESC
               LIMIT 1
          ) latest_job ON TRUE
         WHERE c.story_version_id = ?
         GROUP BY c.id, c.order_index, c.title, c.status, c.estimated_duration_ms,
                  c.updated_at, latest_job.status
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

  private int approvedVisuals(Long storyVersionId) {
    if (storyVersionId == null) return 0;
    Integer value =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(vb.id)::int
              FROM chapters c
              JOIN scenes s ON s.chapter_id = c.id AND s.status = 'APPROVED'
              JOIN visual_beats vb ON vb.scene_id = s.id
             WHERE c.story_version_id = ?
            """,
            Integer.class,
            storyVersionId);
    return value == null ? 0 : value;
  }

  private int processingJobs(Long projectId) {
    Integer value =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)::int
              FROM generation_jobs
             WHERE project_id = ?
               AND status IN ('QUEUED', 'RUNNING', 'STALLED', 'PAUSED_COST_LIMIT')
            """,
            Integer.class,
            projectId);
    return value == null ? 0 : value;
  }

  private int activeCharacterCount(Long projectId) {
    Integer value =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*)::int FROM project_characters WHERE project_id = ? AND status = 'ACTIVE'",
            Integer.class,
            projectId);
    return value == null ? 0 : value;
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
        missingStoryVersion ? null : storyVersionId);
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
      Long storyVersionId) {}
}
