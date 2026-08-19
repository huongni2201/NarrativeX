-- Persist normalized provider results before terminal provider completion so worker
-- materialization can replay after a process crash without paying the provider again.

ALTER TABLE provider_operations
    ADD COLUMN IF NOT EXISTS normalized_result_json JSONB,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Existing COMPLETED rows predate durable result persistence and may already have been
-- materialized successfully. NOT VALID preserves those historical rows while enforcing the
-- invariant for every new or updated row going forward.
ALTER TABLE provider_operations
    ADD CONSTRAINT ck_provider_operations_completed_has_result
    CHECK (status <> 'COMPLETED' OR normalized_result_json IS NOT NULL)
    NOT VALID;

CREATE INDEX IF NOT EXISTS idx_provider_operations_completed_replay
    ON provider_operations (stage_attempt_id, id)
    WHERE status = 'COMPLETED' AND normalized_result_json IS NOT NULL;
