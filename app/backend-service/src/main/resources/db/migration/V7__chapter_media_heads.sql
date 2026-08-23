-- Authoritative pointer to the current visual-generation job for each chapter.
-- The generation job already pins media_plan_id/media_plan_revision, so this table deliberately
-- stores only the selected job identity and avoids duplicating media-plan state.

ALTER TABLE generation_jobs
    ADD CONSTRAINT uq_generation_jobs_id_chapter UNIQUE (id, chapter_id);

CREATE TABLE chapter_media_heads (
    chapter_id BIGINT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    generation_job_id BIGINT NOT NULL UNIQUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chapter_media_heads_generation_job
        FOREIGN KEY (generation_job_id, chapter_id)
        REFERENCES generation_jobs(id, chapter_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_chapter_media_heads_updated
    ON chapter_media_heads (updated_at DESC, chapter_id);

-- Backfill existing databases from the latest visual-generation job that still matches the
-- chapter's current immutable source/storyboard snapshot. Stale jobs are intentionally ignored.
INSERT INTO chapter_media_heads (chapter_id, generation_job_id, updated_at)
SELECT c.id, latest_job.id, COALESCE(latest_job.updated_at, latest_job.created_at)
  FROM chapters c
  JOIN LATERAL (
      SELECT gj.id, gj.created_at, gj.updated_at
        FROM generation_jobs gj
       WHERE gj.chapter_id = c.id
         AND gj.job_type IN ('IMAGE_GENERATE', 'SHOT_IMAGE_GENERATE')
         AND gj.chapter_row_version = c.row_version
         AND gj.source_hash = c.source_hash
         AND gj.storyboard_revision_id = c.current_storyboard_revision_id
         AND gj.media_plan_id IS NOT NULL
         AND gj.media_plan_revision IS NOT NULL
       ORDER BY gj.created_at DESC, gj.id DESC
       LIMIT 1
  ) latest_job ON TRUE
ON CONFLICT (chapter_id) DO UPDATE
SET generation_job_id = EXCLUDED.generation_job_id,
    updated_at = EXCLUDED.updated_at;
