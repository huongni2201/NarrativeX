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
        aggregate.moderationDecision(),
        loadPreviewScenes(projectId, chapterId),
        aggregate.sceneCount(),
        aggregate.visualBeatCount(),
        aggregate.estimatedDurationSeconds(),
        aggregate.storyboardSourceHash(),
        aggregate.hasApprovedOutput(),
        new Analysis(
            aggregate.analysisStatus(),
            aggregate.analysisSourceHash(),
            aggregate.analysisCompletedAt()),
        new ChapterWorkspaceProjection(
            new ProgressStep(
                progressStatus(
                    aggregate.visualGenerationTotal(),
                    aggregate.visualGenerationCompleted(),
                    aggregate.visualGenerationFailed(),
                    aggregate.visualGenerationRunning(),
                    aggregate.visualGenerationQueued(),
                    aggregate.visualGenerationActive(),
                    aggregate.latestVisualGenerationStatus()),
                aggregate.visualGenerationTotal(),
                aggregate.visualGenerationCompleted(),
                aggregate.visualGenerationFailed()),
            new PipelineStep(
                narrationStatus(
                    aggregate.narrationAssetReady(), aggregate.narrationJobStatus()),
                aggregate.narrationCompletedAt()),
            new PipelineStep(
                renderStatus(
                    aggregate.renderManifestCreated(),
                    aggregate.renderArtifactStatus(),
                    aggregate.renderJobStatus()),
                aggregate.renderCompletedAt())));
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
            ),
            visual_generation AS (
                SELECT COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                       COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
                       COUNT(*) FILTER (WHERE status = 'RUNNING')::int AS running,
                       COUNT(*) FILTER (WHERE status = 'QUEUED')::int AS queued,
                       COUNT(*) FILTER (
                           WHERE status IN ('QUEUED', 'RUNNING', 'STALLED', 'UNKNOWN', 'PAUSED_COST_LIMIT')
                       )::int AS active
                  FROM generation_jobs
                 WHERE chapter_id = ?
                   AND job_type IN ('IMAGE_GENERATE', 'SHOT_IMAGE_GENERATE')
            ),
            latest_visual_generation AS (
                SELECT status
                  FROM generation_jobs
                 WHERE chapter_id = ?
                   AND job_type IN ('IMAGE_GENERATE', 'SHOT_IMAGE_GENERATE')
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
            ),
            latest_narration AS (
                SELECT na.id AS narration_asset_id,
                       gj.status AS job_status,
                       CASE WHEN na.id IS NOT NULL THEN na.created_at ELSE NULL END AS completed_at
                  FROM narration_requests nr
                  LEFT JOIN narration_operations no ON no.narration_request_id = nr.id
                  LEFT JOIN generation_jobs gj ON gj.id = no.generation_job_id
                  LEFT JOIN narration_assets na ON na.narration_request_id = nr.id
                 WHERE nr.chapter_id = ?
                 ORDER BY nr.created_at DESC, nr.id DESC
                 LIMIT 1
            ),
            latest_render_manifest AS (
                SELECT id, created_at
                  FROM render_manifests
                 WHERE chapter_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
            ),
            latest_render_artifact AS (
                SELECT fa.generation_job_id,
                       fa.status AS artifact_status,
                       CASE
                           WHEN fa.status = 'READY' THEN COALESCE(fa.updated_at, fa.created_at)
                           ELSE NULL
                       END AS completed_at
                  FROM final_artifacts fa
                  JOIN latest_render_manifest lrm ON lrm.id = fa.render_manifest_id
                 WHERE fa.status <> 'ARCHIVED'
                 ORDER BY fa.created_at DESC, fa.id DESC
                 LIMIT 1
            ),
            latest_render_job AS (
                SELECT gj.status AS job_status
                  FROM generation_jobs gj
                 WHERE (gj.chapter_id = ?
                        AND gj.job_type IN ('CHAPTER_RENDER', 'RENDER_PROJECT', 'RENDER_SHORT'))
                    OR gj.id = (SELECT generation_job_id FROM latest_render_artifact)
                 ORDER BY gj.created_at DESC, gj.id DESC
                 LIMIT 1
            )
            SELECT p.name AS project_name,
                   sv.moderation_decision,
                   ss.scene_count,
                   bs.visual_beat_count,
                   ss.duration_seconds,
                   cr.storyboard_source_hash,
                   aps.has_approved_output,
                   la.status AS analysis_status,
                   la.source_hash AS analysis_source_hash,
                   la.completed_at AS analysis_completed_at,
                   vg.total AS visual_generation_total,
                   vg.completed AS visual_generation_completed,
                   vg.failed AS visual_generation_failed,
                   vg.running AS visual_generation_running,
                   vg.queued AS visual_generation_queued,
                   vg.active AS visual_generation_active,
                   lvg.status AS latest_visual_generation_status,
                   (SELECT narration_asset_id IS NOT NULL FROM latest_narration) AS narration_asset_ready,
                   (SELECT job_status FROM latest_narration) AS narration_job_status,
                   (SELECT completed_at FROM latest_narration) AS narration_completed_at,
                   EXISTS (SELECT 1 FROM latest_render_manifest) AS render_manifest_created,
                   (SELECT artifact_status FROM latest_render_artifact) AS render_artifact_status,
                   (SELECT job_status FROM latest_render_job) AS render_job_status,
                   (SELECT completed_at FROM latest_render_artifact) AS render_completed_at
              FROM projects p
              JOIN chapters c ON c.id = ?
              JOIN story_versions sv ON sv.id = c.story_version_id
                                      AND sv.project_id = p.id
              CROSS JOIN current_revision cr
              CROSS JOIN scene_stats ss
              CROSS JOIN beat_stats bs
              CROSS JOIN approval_state aps
              CROSS JOIN visual_generation vg
              LEFT JOIN latest_analysis la ON TRUE
              LEFT JOIN latest_visual_generation lvg ON TRUE
             WHERE p.id = ?
            """,
            (rs, rowNum) -> mapAggregate(rs),
            chapterId,
            chapterId,
            chapterId,
            chapterId,
            chapterId,
            chapterId,
            chapterId,
            chapterId,
            projectId)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

  private List<PreviewScene> loadPreviewScenes(Long projectId, Long chapterId) {
    return jdbcTemplate.query(
        """
        SELECT s.id, s.order_index, s.title, s.duration_seconds, s.status,
               COUNT(vb.id)::int AS visual_beat_count,
               (array_agg(pa.url ORDER BY vb.order_index, vb.id)
                   FILTER (WHERE pa.url IS NOT NULL))[1] AS preview_image_url
          FROM chapters c
          JOIN scenes s ON s.storyboard_revision_id = c.current_storyboard_revision_id
          LEFT JOIN visual_beats vb ON vb.scene_id = s.id
          LEFT JOIN project_assets pa
            ON pa.id = vb.preview_asset_id
           AND pa.project_id = ?
           AND pa.asset_type = 'IMAGE'
           AND pa.status = 'ACTIVE'
         WHERE c.id = ? AND s.status <> 'OUTDATED'
         GROUP BY s.id, s.order_index, s.title, s.duration_seconds, s.status
         ORDER BY s.order_index ASC, s.id ASC
         LIMIT 4
        """,
        (rs, rowNum) -> mapPreviewScene(rs),
        projectId,
        chapterId);
  }

  private static AggregateRow mapAggregate(ResultSet rs) throws SQLException {
    return new AggregateRow(
        rs.getString("project_name"),
        rs.getString("moderation_decision"),
        rs.getInt("scene_count"),
        rs.getInt("visual_beat_count"),
        rs.getLong("duration_seconds"),
        rs.getString("storyboard_source_hash"),
        rs.getBoolean("has_approved_output"),
        rs.getString("analysis_status"),
        rs.getString("analysis_source_hash"),
        toInstant(rs.getTimestamp("analysis_completed_at")),
        rs.getInt("visual_generation_total"),
        rs.getInt("visual_generation_completed"),
        rs.getInt("visual_generation_failed"),
        rs.getInt("visual_generation_running"),
        rs.getInt("visual_generation_queued"),
        rs.getInt("visual_generation_active"),
        rs.getString("latest_visual_generation_status"),
        rs.getBoolean("narration_asset_ready"),
        rs.getString("narration_job_status"),
        toInstant(rs.getTimestamp("narration_completed_at")),
        rs.getBoolean("render_manifest_created"),
        rs.getString("render_artifact_status"),
        rs.getString("render_job_status"),
        toInstant(rs.getTimestamp("render_completed_at")));
  }

  private static String progressStatus(
      int total,
      int completed,
      int failed,
      int running,
      int queued,
      int active,
      String latestStatus) {
    if (total == 0) {
      return "NOT_STARTED";
    }
    if (active > 0) {
      if (running > 0) {
        return "RUNNING";
      }
      if (queued > 0) {
        return "QUEUED";
      }
      return latestStatus;
    }
    if (failed > 0) {
      return "FAILED";
    }
    return completed == total ? "COMPLETED" : "QUEUED";
  }

  private static String narrationStatus(boolean assetReady, String jobStatus) {
    if (assetReady) {
      return "READY";
    }
    if ("RUNNING".equals(jobStatus)) {
      return "GENERATING";
    }
    if ("QUEUED".equals(jobStatus)) {
      return "QUEUED";
    }
    if (jobStatus != null) {
      return "FAILED";
    }
    return "NOT_STARTED";
  }

  private static String renderStatus(
      boolean manifestCreated, String artifactStatus, String jobStatus) {
    if ("READY".equals(artifactStatus)) {
      return "COMPLETED";
    }
    if ("FAILED".equals(artifactStatus) || "FAILED".equals(jobStatus)) {
      return "FAILED";
    }
    if ("PENDING".equals(artifactStatus) || isActive(jobStatus)) {
      return "PROCESSING";
    }
    return manifestCreated ? "CREATED" : "NOT_STARTED";
  }

  private static boolean isActive(String status) {
    if (status == null) {
      return false;
    }
    return switch (status) {
      case "QUEUED", "RUNNING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> true;
      default -> false;
    };
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
        rs.getString("preview_image_url"));
  }

  private static Instant toInstant(Timestamp value) {
    return value == null ? null : value.toInstant();
  }

  private record AggregateRow(
      String projectName,
      String moderationDecision,
      int sceneCount,
      int visualBeatCount,
      long estimatedDurationSeconds,
      String storyboardSourceHash,
      boolean hasApprovedOutput,
      String analysisStatus,
      String analysisSourceHash,
      Instant analysisCompletedAt,
      int visualGenerationTotal,
      int visualGenerationCompleted,
      int visualGenerationFailed,
      int visualGenerationRunning,
      int visualGenerationQueued,
      int visualGenerationActive,
      String latestVisualGenerationStatus,
      boolean narrationAssetReady,
      String narrationJobStatus,
      Instant narrationCompletedAt,
      boolean renderManifestCreated,
      String renderArtifactStatus,
      String renderJobStatus,
      Instant renderCompletedAt) {}
}
