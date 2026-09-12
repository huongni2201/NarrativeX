-- Monetary credit accounting is no longer part of runtime admission or settlement.
-- Preserve reservation rows only for concurrency/export-capacity fencing while migrating
-- already-applied CREDIT rows to the non-monetary CAPACITY kind.

ALTER TABLE quota_reservations
    DROP CONSTRAINT IF EXISTS ck_quota_reservations_kind,
    DROP CONSTRAINT IF EXISTS ck_quota_reservations_units;

UPDATE quota_reservations
   SET quota_kind = 'CAPACITY'
 WHERE quota_kind = 'CREDIT';

UPDATE quota_reservations
   SET estimated_cost = 0,
       actual_cost = NULL,
       billing_currency = NULL;

UPDATE usage_windows
   SET credits_used = 0;

UPDATE plan_entitlements
   SET monthly_credits = NULL;

UPDATE provider_operations
   SET actual_cost = NULL,
       billing_currency = NULL,
       usage_json = NULL,
       pricing_snapshot_json = NULL;

ALTER TABLE quota_reservations
    ADD CONSTRAINT ck_quota_reservations_kind
        CHECK (quota_kind IN ('CAPACITY', 'LONGFORM_EXPORT')),
    ADD CONSTRAINT ck_quota_reservations_units
        CHECK (
            (quota_kind = 'CAPACITY' AND units = 0)
            OR (quota_kind = 'LONGFORM_EXPORT' AND units > 0)
        );

CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
        WITH consumed AS (
            UPDATE quota_reservations
               SET status = 'CONSUMED',
                   actual_cost = NULL,
                   billing_currency = NULL,
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED'
             RETURNING user_id, period_key, quota_kind, units
        ), settled AS (
            SELECT user_id,
                   period_key,
                   SUM(CASE WHEN quota_kind = 'LONGFORM_EXPORT' THEN units ELSE 0 END)::integer
                       AS longform_units
              FROM consumed
             GROUP BY user_id, period_key
        )
        UPDATE usage_windows uw
           SET longform_exports = uw.longform_exports + settled.longform_units,
               row_version = uw.row_version + 1
          FROM settled
         WHERE uw.user_id = settled.user_id
           AND uw.period_key = settled.period_key;
    ELSIF NEW.status IN ('FAILED', 'CANCELED')
          AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE quota_reservations
           SET status = 'RELEASED',
               actual_cost = NULL,
               billing_currency = NULL,
               finalized_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP,
               row_version = row_version + 1
         WHERE generation_job_id = NEW.id
           AND status = 'RESERVED';
    END IF;

    RETURN NEW;
END;
$$;
