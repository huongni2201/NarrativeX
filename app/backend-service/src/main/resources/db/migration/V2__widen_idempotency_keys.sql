-- Widen generation-job idempotency keys so deterministic server-generated keys
-- and client-provided keys are not constrained by the old 200-character limit.
-- PostgreSQL stores VARCHAR values at their actual length; widening the declared
-- maximum does not preallocate 512 bytes per row.

ALTER TABLE generation_jobs
    ALTER COLUMN idempotency_key TYPE VARCHAR(512);
