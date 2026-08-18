-- Project Overview read-model support.
-- Keep dashboard-only fields nullable; existing projects remain valid and the UI falls back to
-- story content / a visual placeholder when these values have not been configured yet.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(1024);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_status
    ON generation_jobs (project_id, status);

CREATE INDEX IF NOT EXISTS idx_scenes_chapter_status
    ON scenes (chapter_id, status);
