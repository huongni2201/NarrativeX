package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterWorkspaceResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetChapterWorkspaceUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final JdbcTemplate jdbcTemplate;

  @Transactional(readOnly = true)
  public ApiResponse<ChapterWorkspaceResponse> execute(Long projectId, Long chapterId) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());

    WorkspaceSnapshot snapshot = loadSnapshot(projectId, chapterId);
    List<ChapterWorkspaceResponse.PreviewScene> previewScenes = loadPreviewScenes(chapterId);

    boolean hasStoryboard = snapshot.sceneCount() > 0 && snapshot.visualBeatCount() > 0;
    boolean sourceOutdated =
        snapshot.analysisSourceHash() != null
            && !snapshot.analysisSourceHash().equals(chapter.getSourceHash());
    String analysisStatus =
        snapshot.analysisStatus() == null ? "NOT_STARTED" : snapshot.analysisStatus();
    String planningStatus =
        hasStoryboard && !sourceOutdated && "COMPLETED".equals(analysisStatus)
            ? "COMPLETED"
            : "NOT_STARTED";

    var response =
        new ChapterWorkspaceResponse(
            ChapterResponse.from(chapter),
            snapshot.projectName(),
            new ChapterWorkspaceResponse.Summary(
                snapshot.sceneCount(),
                snapshot.visualBeatCount(),
                snapshot.estimatedDurationSeconds()),
            new ChapterWorkspaceResponse.Pipeline(
                new ChapterWorkspaceResponse.PipelineStep(
                    analysisStatus, snapshot.analysisCompletedAt()),
                new ChapterWorkspaceResponse.PipelineStep(
                    planningStatus, snapshot.analysisCompletedAt()),
                new ChapterWorkspaceResponse.ProgressStep("NOT_STARTED", 0, 0, 0),
                new ChapterWorkspaceResponse.PipelineStep("NOT_STARTED", null),
                new ChapterWorkspaceResponse.PipelineStep("NOT_STARTED", null),
                sourceOutdated),
            previewScenes,
            new ChapterWorkspaceResponse.Capabilities(
                !chapter.getSourceText().isBlank() && !isActive(analysisStatus),
                false,
                false,
                false));

    return ApiResponse.success(response);
  }

  private WorkspaceSnapshot loadSnapshot(Long projectId, Long chapterId) {
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
            (rs, rowNum) -> mapSnapshot(rs),
            chapterId,
            chapterId,
            chapterId,
            projectId)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

  private List<ChapterWorkspaceResponse.PreviewScene> loadPreviewScenes(Long chapterId) {
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

  private static WorkspaceSnapshot mapSnapshot(ResultSet rs) throws SQLException {
    return new WorkspaceSnapshot(
        rs.getString("project_name"),
        rs.getInt("scene_count"),
        rs.getInt("visual_beat_count"),
        rs.getLong("duration_seconds"),
        rs.getString("analysis_status"),
        rs.getString("analysis_source_hash"),
        toInstant(rs.getTimestamp("analysis_completed_at")));
  }

  private static ChapterWorkspaceResponse.PreviewScene mapPreviewScene(ResultSet rs)
      throws SQLException {
    int duration = rs.getInt("duration_seconds");
    Integer durationSeconds = rs.wasNull() ? null : duration;
    return new ChapterWorkspaceResponse.PreviewScene(
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

  private static boolean isActive(String status) {
    return switch (status) {
      case "QUEUED", "RUNNING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT" -> true;
      default -> false;
    };
  }

  private record WorkspaceSnapshot(
      String projectName,
      int sceneCount,
      int visualBeatCount,
      long estimatedDurationSeconds,
      String analysisStatus,
      String analysisSourceHash,
      Instant analysisCompletedAt) {}
}
