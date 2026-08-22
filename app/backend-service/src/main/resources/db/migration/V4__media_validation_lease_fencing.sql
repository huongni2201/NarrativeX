-- Fence media-validation workers with an ownership token that changes on every claim.
ALTER TABLE media_validation_jobs
    ADD COLUMN lease_token UUID,
    ADD COLUMN row_version BIGINT NOT NULL DEFAULT 0;

-- Rows created before lease fencing must not retain ambiguous ownership. Existing running rows
-- with complete lease metadata receive a token; incomplete running rows are made retryable.
UPDATE media_validation_jobs
   SET status = 'RETRYABLE', worker_id = NULL, lease_until = NULL, lease_token = NULL
 WHERE status = 'RUNNING'
   AND (worker_id IS NULL OR lease_until IS NULL);

UPDATE media_validation_jobs
   SET lease_token = gen_random_uuid()
 WHERE status = 'RUNNING' AND lease_token IS NULL;

UPDATE media_validation_jobs
   SET worker_id = NULL, lease_token = NULL, lease_until = NULL
 WHERE status <> 'RUNNING';

ALTER TABLE media_validation_jobs
    ADD CONSTRAINT ck_media_validation_jobs_lease_consistency CHECK (
        (status = 'RUNNING'
            AND worker_id IS NOT NULL
            AND lease_token IS NOT NULL
            AND lease_until IS NOT NULL)
        OR
        (status <> 'RUNNING'
            AND worker_id IS NULL
            AND lease_token IS NULL
            AND lease_until IS NULL)
    );

CREATE INDEX IF NOT EXISTS idx_media_validation_jobs_expired_leases
    ON media_validation_jobs (lease_until, id)
    WHERE status = 'RUNNING';
