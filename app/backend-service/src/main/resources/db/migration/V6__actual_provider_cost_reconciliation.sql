-- Reconcile quota consumption to durable provider usage instead of the authorization estimate.

ALTER TABLE provider_operations
    ADD COLUMN actual_cost NUMERIC(19, 9),
    ADD COLUMN billing_currency VARCHAR(3),
    ADD COLUMN usage_json JSONB,
    ADD COLUMN pricing_snapshot_json JSONB;

ALTER TABLE provider_operations
    ADD CONSTRAINT ck_provider_operations_actual_cost_nonnegative
        CHECK (actual_cost IS NULL OR actual_cost >= 0),
    ADD CONSTRAINT ck_provider_operations_billing_complete
        CHECK (
            (actual_cost IS NULL AND billing_currency IS NULL AND usage_json IS NULL
                AND pricing_snapshot_json IS NULL)
            OR (actual_cost IS NOT NULL AND billing_currency IS NOT NULL
                AND usage_json IS NOT NULL AND pricing_snapshot_json IS NOT NULL)
        );

ALTER TABLE quota_reservations
    ADD COLUMN actual_cost NUMERIC(19, 9),
    ADD COLUMN billing_currency VARCHAR(3);

ALTER TABLE quota_reservations
    ADD CONSTRAINT ck_quota_reservations_actual_cost_nonnegative
        CHECK (actual_cost IS NULL OR actual_cost >= 0);

-- Historical CONSUMED reservations predate provider usage capture. Preserve their charged amount as
-- the best available reconciliation value so history remains internally consistent.
UPDATE quota_reservations
   SET actual_cost = estimated_cost,
       billing_currency = 'USD'
 WHERE status = 'CONSUMED'
   AND actual_cost IS NULL;

CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    reconciled_cost NUMERIC(19, 9);
    reconciled_currency VARCHAR(3);
    billed_operation_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(po.actual_cost), 0),
           CASE WHEN COUNT(DISTINCT po.billing_currency) FILTER (WHERE po.actual_cost IS NOT NULL) = 1
                THEN MAX(po.billing_currency) FILTER (WHERE po.actual_cost IS NOT NULL)
                ELSE NULL
           END,
           COUNT(*) FILTER (WHERE po.actual_cost IS NOT NULL)
      INTO reconciled_cost, reconciled_currency, billed_operation_count
      FROM provider_operations po
      JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
     WHERE sa.generation_job_id = NEW.id;

    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
        IF billed_operation_count = 0 OR reconciled_currency IS NULL THEN
            RAISE EXCEPTION 'Cannot complete generation job % without reconciled provider billing', NEW.id;
        END IF;

        WITH consumed AS (
            UPDATE quota_reservations
               SET status = 'CONSUMED',
                   actual_cost = reconciled_cost,
                   billing_currency = reconciled_currency,
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED'
             RETURNING user_id, period_key, actual_cost
        )
        UPDATE usage_windows uw
           SET credits_used = uw.credits_used + consumed.actual_cost,
               row_version = uw.row_version + 1
          FROM consumed
         WHERE uw.user_id = consumed.user_id
           AND uw.period_key = consumed.period_key;
    ELSIF NEW.status IN ('FAILED', 'CANCELED')
          AND OLD.status IS DISTINCT FROM NEW.status THEN
        IF billed_operation_count > 0
           AND reconciled_currency IS NOT NULL
           AND reconciled_cost > 0 THEN
            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = reconciled_cost,
                       billing_currency = reconciled_currency,
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        ELSE
            UPDATE quota_reservations
               SET status = 'RELEASED',
                   actual_cost = 0,
                   billing_currency = COALESCE(reconciled_currency, 'USD'),
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON COLUMN quota_reservations.estimated_cost IS
    'Admission authorization amount; RESERVED capacity uses this value.';
COMMENT ON COLUMN quota_reservations.actual_cost IS
    'Terminal provider cost reconciled from durable provider usage; never used for admission.';
