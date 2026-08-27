-- Speeds up the Chapter Workspace projection, which repeatedly filters media generation jobs
-- by the current chapter/source/storyboard revision before grouping by job type and status.
CREATE INDEX IF NOT EXISTS idx_generation_jobs_chapter_workspace_lookup
    ON generation_jobs (
        chapter_id,
        chapter_row_version,
        storyboard_revision_id,
        source_hash,
        job_type,
        status
    )
    INCLUDE (media_plan_id, media_plan_revision)
    WHERE chapter_id IS NOT NULL;
