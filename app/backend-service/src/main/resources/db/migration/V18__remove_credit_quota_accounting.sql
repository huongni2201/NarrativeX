-- Monetary credit accounting is no longer part of runtime admission.
-- Preserve the reservation table for concurrency/export-capacity fencing while migrating
-- already-applied CREDIT rows to the non-monetary CAPACITY kind.

ALTER TABLE quota_reservations
    DROP CONSTRAINT IF EXISTS ck_quota_reservations_kind,
    DROP CONSTRAINT IF EXISTS ck_quota_reservations_units;

UPDATE quota_reservations
   SET quota_kind = 'CAPACITY'
 WHERE quota_kind = 'CREDIT';

ALTER TABLE quota_reservations
    ADD CONSTRAINT ck_quota_reservations_kind
        CHECK (quota_kind IN ('CAPACITY', 'LONGFORM_EXPORT')),
    ADD CONSTRAINT ck_quota_reservations_units
        CHECK (
            (quota_kind = 'CAPACITY' AND units = 0)
            OR (quota_kind = 'LONGFORM_EXPORT' AND units > 0)
        );
