package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcStoryboardRevisionAccess implements StoryboardRevisionAccess {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public void lockChapter(Long chapterId) {
    jdbcTemplate.queryForList("SELECT pg_advisory_xact_lock(?)", chapterId);
  }

  @Override
  public Snapshot current(Long chapterId) {
    return jdbcTemplate
        .query(
            """
            SELECT sr.id,
                   sr.source_hash,
                   EXISTS(
                       SELECT 1
                         FROM scenes s
                         LEFT JOIN visual_beats vb ON vb.scene_id = s.id
                        WHERE s.storyboard_revision_id = sr.id
                          AND (s.status = 'APPROVED' OR vb.review_status = 'APPROVED')
                   ) AS has_approved_output
              FROM chapters c
              JOIN storyboard_revisions sr ON sr.id = c.current_storyboard_revision_id
             WHERE c.id = ?
            """,
            (rs, rowNum) ->
                new Snapshot(
                    rs.getLong("id"),
                    rs.getString("source_hash"),
                    rs.getBoolean("has_approved_output")),
            chapterId)
        .stream()
        .findFirst()
        .orElse(Snapshot.empty());
  }

  @Override
  public Long createDraft(Long chapterId, String sourceHash, long sourceRowVersion) {
    Objects.requireNonNull(sourceHash, "sourceHash");
    Long revisionId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO storyboard_revisions
              (chapter_id, revision_number, source_hash, source_row_version, based_on_revision_id, status)
            SELECT c.id,
                   COALESCE((SELECT MAX(sr.revision_number) + 1
                               FROM storyboard_revisions sr
                              WHERE sr.chapter_id = c.id), 1),
                   ?,
                   ?,
                   c.current_storyboard_revision_id,
                   'DRAFT'
              FROM chapters c
             WHERE c.id = ?
            RETURNING id
            """,
            Long.class,
            sourceHash,
            sourceRowVersion,
            chapterId);
    if (revisionId == null) {
      throw new IllegalStateException(
          "Failed to create storyboard revision for chapter " + chapterId);
    }
    return revisionId;
  }
}
