package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcChapterAnalysisSnapshotRepository implements ChapterAnalysisSnapshotRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public ChapterAnalysisSource requireOwnedByProject(
      Long projectId, Long chapterId, String userId) {
    return jdbcTemplate
        .query(
            """
            SELECT c.id, c.story_version_id, c.row_version, c.source_hash, c.source_text
              FROM chapters c
              JOIN story_versions sv ON sv.id = c.story_version_id
              JOIN projects p ON p.id = sv.project_id
             WHERE c.id = ?
               AND p.id = ?
               AND p.owner_id = ?
               AND p.archived_at IS NULL
            """,
            (rs, rowNum) ->
                new ChapterAnalysisSource(
                    rs.getLong("id"),
                    rs.getLong("story_version_id"),
                    rs.getLong("row_version"),
                    rs.getString("source_hash"),
                    rs.getString("source_text")),
            chapterId,
            projectId,
            userId)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
  }
}
