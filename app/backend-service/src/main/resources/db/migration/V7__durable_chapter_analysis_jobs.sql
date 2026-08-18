-- Durable Chapter Analysis vertical slice.
-- PostgreSQL owns the Chapter snapshot and idempotency boundary; Redis remains optional delivery only.

ALTER TABLE generation_jobs
    ADD COLUMN IF NOT EXISTS story_version_id BIGINT REFERENCES story_versions(id),
    ADD COLUMN IF NOT EXISTS chapter_id BIGINT REFERENCES chapters(id),
    ADD COLUMN IF NOT EXISTS chapter_row_version BIGINT,
    ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_text TEXT,
    ADD COLUMN IF NOT EXISTS source_language VARCHAR(16),
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS uq_generation_jobs_idempotency_key
    ON generation_jobs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generation_jobs_chapter_created
    ON generation_jobs (chapter_id, created_at DESC)
    WHERE chapter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stage_attempts_claimable
    ON stage_attempts (status, created_at, id)
    WHERE status IN ('QUEUED', 'STALLED');
