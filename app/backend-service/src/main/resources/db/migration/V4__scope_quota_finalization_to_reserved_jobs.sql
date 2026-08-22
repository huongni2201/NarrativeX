-- Provider billing is required only for jobs with a durable active quota reservation.
-- Local CPU/media jobs may complete without provider_operations rows.
CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    has_active_reservation BOOLEAN;
    reconciled_cost NUMERIC(19, 9);
    reconciled_currency VARCHAR(3);
    billed_operation_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1
          FROM quota_reservations qr
         WHERE qr.generation_job_id = NEW.id
           AND qr.status = 'RESERVED'
    ) INTO has_active_reservation;

    IF NOT has_active_reservation THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(po.actual_cost), 0),
           CASE
               WHEN COUNT(DISTINCT po.billing_currency)
                    FILTER (WHERE po.actual_cost IS NOT NULL) = 1
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
            RAISE EXCEPTION
                'Cannot complete generation job % without reconciled provider billing', NEW.id;
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
