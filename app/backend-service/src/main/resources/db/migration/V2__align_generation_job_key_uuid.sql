-- The application contract exposes generation_jobs.job_id as UUID. V1 created
-- this column as VARCHAR(36), which makes PostgreSQL reject UUID parameters in
-- lookups and updates. Convert existing UUID-shaped values in place.
ALTER TABLE generation_jobs
    ALTER COLUMN job_id TYPE UUID
    USING job_id::uuid;
