ALTER TABLE stage_attempts
    ADD COLUMN IF NOT EXISTS lease_token UUID;

CREATE INDEX IF NOT EXISTS idx_stage_attempts_running_lease
    ON stage_attempts (id, worker_id, lease_token)
    WHERE status = 'RUNNING';
