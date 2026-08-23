package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

public interface ChapterWorkspaceMapper extends NarrativeXMyBatisMapper {
  ChapterWorkspaceAggregateRow aggregate(
      @Param("projectId") Long projectId, @Param("chapterId") Long chapterId);

  List<ChapterWorkspacePreviewRow> previewScenes(
      @Param("projectId") Long projectId, @Param("chapterId") Long chapterId);

  @Select(
      """
      WITH current_context AS (
          SELECT c.id AS chapter_id,
                 c.row_version AS chapter_row_version,
                 c.source_hash,
                 c.current_storyboard_revision_id AS storyboard_revision_id
            FROM chapters c
            JOIN story_versions sv ON sv.id = c.story_version_id
            JOIN projects p ON p.id = sv.project_id
           WHERE c.id = #{chapterId}
             AND p.id = #{projectId}
      ), current_plan AS (
          SELECT mp.id, mp.revision
            FROM current_context cc
            JOIN media_plans mp ON mp.chapter_id = cc.chapter_id
           WHERE mp.chapter_row_version = cc.chapter_row_version
             AND mp.source_hash = cc.source_hash
             AND mp.storyboard_revision_id = cc.storyboard_revision_id
           ORDER BY mp.revision DESC, mp.created_at DESC
           LIMIT 1
      )
      SELECT gj.job_id AS latest_job_id,
             gj.media_plan_id,
             gj.media_plan_revision
        FROM current_context cc
        JOIN current_plan cp ON TRUE
        LEFT JOIN LATERAL (
            SELECT j.job_id, j.media_plan_id, j.media_plan_revision
              FROM generation_jobs j
             WHERE j.chapter_id = cc.chapter_id
               AND j.job_type IN ('IMAGE_GENERATE', 'SHOT_IMAGE_GENERATE')
               AND j.chapter_row_version = cc.chapter_row_version
               AND j.source_hash = cc.source_hash
               AND j.storyboard_revision_id = cc.storyboard_revision_id
               AND j.media_plan_id = cp.id
               AND j.media_plan_revision = cp.revision
             ORDER BY j.created_at DESC, j.id DESC
             LIMIT 1
        ) gj ON TRUE
      """)
  @Results({
    @Result(property = "latestJobId", column = "latest_job_id"),
    @Result(property = "mediaPlanId", column = "media_plan_id"),
    @Result(property = "mediaPlanRevision", column = "media_plan_revision")
  })
  ChapterWorkspaceMediaIdentityRow latestVisualMediaIdentity(
      @Param("projectId") Long projectId, @Param("chapterId") Long chapterId);
}
