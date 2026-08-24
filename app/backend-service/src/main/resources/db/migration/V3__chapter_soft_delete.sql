ALTER TABLE chapters
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE chapters
    DROP CONSTRAINT IF EXISTS uk_chapters_story_order;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chapters_story_order_active
    ON chapters (story_version_id, order_index)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chapters_deleted_at
    ON chapters (deleted_at)
    WHERE deleted_at IS NOT NULL;
