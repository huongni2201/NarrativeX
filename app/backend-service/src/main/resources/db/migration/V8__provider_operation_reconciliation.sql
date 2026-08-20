-- Harden provider-operation recovery so ambiguous external submissions cannot spin forever.
-- UNKNOWN remains the canonical ambiguous state; reconciliation is only scheduled when safe.

ALTER TABLE provider_operations
    ADD COLUMN IF NOT EXISTS next_reconcile_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reconcile_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reconcile_error TEXT;

ALTER TABLE provider_operations
    ADD CONSTRAINT ck_provider_operations_reconcile_attempts
    CHECK (reconcile_attempts >= 0)
    NOT VALID;

-- Rows written by the old worker could be SUBMITTED before any provider request was actually sent.
-- With no durable provider operation id there is no safe way to distinguish that crash window from
-- a request that reached the provider, so preserve ambiguity and refuse blind resubmission.
UPDATE provider_operations
   SET status = 'UNKNOWN',
       next_reconcile_at = NULL,
       last_reconcile_error = COALESCE(
           last_reconcile_error,
           'Legacy submission has no durable provider operation id; manual/provider reconciliation required'
       ),
       updated_at = CURRENT_TIMESTAMP,
       row_version = row_version + 1
 WHERE status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
   AND provider_operation_id IS NULL;

-- Existing non-terminal operations with a real durable provider id are immediately eligible for
-- the reconciler. Future attempts are paced by next_reconcile_at in the worker repository.
UPDATE provider_operations
   SET next_reconcile_at = COALESCE(next_reconcile_at, CURRENT_TIMESTAMP)
 WHERE status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
   AND provider_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_operations_reconcile_due
    ON provider_operations (next_reconcile_at, id)
    WHERE status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
      AND next_reconcile_at IS NOT NULL;
