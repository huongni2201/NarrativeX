-- -----------------------------------------------------------------------------
-- NarrativeX Compute Orchestration: Async State Machine & Worker Callbacks
-- -----------------------------------------------------------------------------

ALTER TABLE generation_jobs
    DROP CONSTRAINT ck_generation_jobs_status;

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_status CHECK (status IN (
        'QUEUED', 'SUBMITTING', 'SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'RECONCILING', 'STALLED'
    ));

ALTER TABLE generation_jobs
    ADD COLUMN submission_state VARCHAR(32),
    ADD COLUMN compute_attempt_id UUID,
    ADD COLUMN compute_execution_handle VARCHAR(255),
    ADD COLUMN compute_sequence BIGINT,
    ADD COLUMN last_compute_state VARCHAR(32),
    ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN last_reconciled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN next_reconcile_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN reconcile_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_event_id VARCHAR(255),
    ADD COLUMN last_event_sequence BIGINT,
    ADD COLUMN callback_received_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_generation_jobs_reconciliation
    ON generation_jobs (status, next_reconcile_at)
    WHERE status IN ('SUBMITTED', 'RUNNING', 'UNKNOWN', 'RECONCILING');

CREATE INDEX idx_generation_jobs_compute_attempt
    ON generation_jobs (job_id, compute_attempt_id)
    WHERE compute_attempt_id IS NOT NULL;

CREATE TABLE compute_event_receipts (
    event_id VARCHAR(255) PRIMARY KEY,
    task_id UUID NOT NULL,
    attempt_id UUID NOT NULL,
    sequence BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload_hash VARCHAR(64)
);

CREATE INDEX idx_compute_event_receipts_task_attempt
    ON compute_event_receipts (task_id, attempt_id, sequence);
