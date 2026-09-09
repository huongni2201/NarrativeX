ALTER TABLE quota_reservations
    ADD COLUMN quota_kind VARCHAR(32) NOT NULL DEFAULT 'CREDIT',
    ADD COLUMN units INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN export_units_settled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT ck_quota_reservations_kind
        CHECK (quota_kind IN ('CREDIT', 'LONGFORM_EXPORT')),
    ADD CONSTRAINT ck_quota_reservations_units
        CHECK (
            (quota_kind = 'CREDIT' AND units = 0)
            OR (quota_kind = 'LONGFORM_EXPORT' AND units > 0)
        );

CREATE INDEX ix_quota_reservations_active_export
    ON quota_reservations (user_id, period_key, quota_kind)
    WHERE status = 'RESERVED';

CREATE OR REPLACE FUNCTION settle_export_quota_on_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
        WITH settled AS (
            UPDATE quota_reservations
               SET export_units_settled = TRUE,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND quota_kind = 'LONGFORM_EXPORT'
               AND status = 'CONSUMED'
               AND export_units_settled = FALSE
             RETURNING user_id, period_key, units
        )
        UPDATE usage_windows uw
           SET longform_exports = uw.longform_exports + settled.units,
               row_version = uw.row_version + 1
          FROM settled
         WHERE uw.user_id = settled.user_id
           AND uw.period_key = settled.period_key;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER zzz_generation_jobs_settle_export_quota
AFTER UPDATE OF status ON generation_jobs
FOR EACH ROW
WHEN (NEW.status = 'COMPLETED')
EXECUTE FUNCTION settle_export_quota_on_job_completion();
