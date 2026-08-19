package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterWorkspaceResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterWorkspacePipelinePolicy;
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

    String projectName =
        jdbcTemplate.queryForObject(
            "select name from projects where id = ?", String.class, projectId);

    List<ChapterWorkspaceResponse.PreviewScene> previewScenes =
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

    AnalysisProjection analysis = latestAnalysis(chapterId);
    boolean hasStoryboard =
        sceneCount != null && sceneCount > 0 && visualBeatCount != null && visualBeatCount > 0;
    var pipelineState =
        ChapterWorkspacePipelinePolicy.resolve(
            chapter.getSourceHash(), analysis.status(), analysis.sourceHash(), hasStoryboard);

    var response =
        new ChapterWorkspaceResponse(
            ChapterResponse.from(chapter),
            projectName,
            new ChapterWorkspaceResponse.Summary(
                sceneCount == null ? 0 : sceneCount,
                visualBeatCount == null ? 0 : visualBeatCount,
                estimatedDurationSeconds == null ? 0 : estimatedDurationSeconds),
            new ChapterWorkspaceResponse.Pipeline(
                new ChapterWorkspaceResponse.PipelineStep(
                    pipelineState.analysisStatus(), analysis.completedAt()),
                new ChapterWorkspaceResponse.PipelineStep(
                    pipelineState.planningStatus(), analysis.completedAt()),
                new ChapterWorkspaceResponse.ProgressStep("NOT_STARTED", 0, 0, 0),
                new ChapterWorkspaceResponse.PipelineStep("NOT_STARTED", null),
                new ChapterWorkspaceResponse.PipelineStep("NOT_STARTED", null),
                pipelineState.sourceOutdated()),
            previewScenes,
            new ChapterWorkspaceResponse.Capabilities(
                !chapter.getSourceText().isBlank() && !pipelineState.analysisActive(),
                false,
                false,
                false));

    return ApiResponse.success(response);
  }

  private AnalysisProjection latestAnalysis(Long chapterId) {
    List<AnalysisProjection> results =
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
                new AnalysisProjection(
                    rs.getString("status"),
                    rs.getString("source_hash"),
                    toInstant(rs.getTimestamp("completed_at"))),
            chapterId);
    return results.isEmpty() ? new AnalysisProjection(null, null, null) : results.getFirst();
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

  private record AnalysisProjection(String status, String sourceHash, Instant completedAt) {}
}
