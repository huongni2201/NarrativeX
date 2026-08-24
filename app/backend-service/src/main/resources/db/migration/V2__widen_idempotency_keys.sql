-- Normalize idempotency-key capacity across durable request boundaries.
-- PostgreSQL stores VARCHAR values at their actual length; widening the declared
-- maximum does not preallocate 512 bytes per row.

ALTER TABLE chapter_creation_idempotency
    ALTER COLUMN idempotency_key TYPE VARCHAR(512);

ALTER TABLE generation_jobs
    ALTER COLUMN idempotency_key TYPE VARCHAR(512);

ALTER TABLE media_upload_sessions
    ALTER COLUMN idempotency_key TYPE VARCHAR(512);
