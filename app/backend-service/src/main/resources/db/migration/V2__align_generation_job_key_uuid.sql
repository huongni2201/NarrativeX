-- The application contract exposes generation_jobs.job_id as UUID. V1 created
-- this column as VARCHAR(36), which makes PostgreSQL reject UUID parameters in
-- lookups and updates. Validate legacy data first so a bad historical value
-- produces an actionable Flyway error instead of an opaque cast failure.
DO $$
DECLARE
    invalid_values TEXT;
BEGIN
    SELECT string_agg(job_id, ', ' ORDER BY job_id)
      INTO invalid_values
      FROM (
          SELECT job_id
            FROM generation_jobs
           WHERE job_id IS NULL
              OR job_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           ORDER BY job_id
           LIMIT 10
      ) invalid;

    IF invalid_values IS NOT NULL THEN
        RAISE EXCEPTION
            'V2 cannot convert generation_jobs.job_id to UUID; invalid values: %',
            invalid_values
            USING HINT = 'Repair or replace legacy non-UUID job_id values before rerunning Flyway.';
    END IF;
END $$;

ALTER TABLE generation_jobs
    ALTER COLUMN job_id TYPE UUID
    USING job_id::uuid;
