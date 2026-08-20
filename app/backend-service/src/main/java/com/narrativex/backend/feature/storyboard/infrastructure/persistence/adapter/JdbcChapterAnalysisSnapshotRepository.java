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
  public ChapterAnalysisSource requireById(Long chapterId) {
    return jdbcTemplate
        .query(
            """
            SELECT id, story_version_id, row_version, source_hash, source_text
              FROM chapters
             WHERE id = ?
            """,
            (rs, rowNum) ->
                new ChapterAnalysisSource(
                    rs.getLong("id"),
                    rs.getLong("story_version_id"),
                    rs.getLong("row_version"),
                    rs.getString("source_hash"),
                    rs.getString("source_text")),
            chapterId)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
  }
}
