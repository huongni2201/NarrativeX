CREATE INDEX IF NOT EXISTS idx_stage_attempts_running_heartbeat
    ON stage_attempts (heartbeat_at, created_at, id)
    WHERE status = 'RUNNING';
