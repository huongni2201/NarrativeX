-- Production-safe forward migration: scope replay keys by authenticated owner and
-- provide an index for bounded cleanup of abandoned presigned uploads.
DROP INDEX IF EXISTS uq_generation_jobs_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_generation_jobs_owner_idempotency_key
    ON generation_jobs (requested_by_user_id, idempotency_key)
    WHERE requested_by_user_id IS NOT NULL AND idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_expired_pending
    ON media_upload_sessions (expires_at, id)
    WHERE status = 'PENDING_UPLOAD';
