-- Enforce immutable completed provider results without colliding with versioned migrations.
-- This repeatable migration is intentionally idempotent because Flyway may re-run it on checksum changes.

ALTER TABLE provider_operations
    ADD COLUMN IF NOT EXISTS result_fingerprint VARCHAR(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_provider_operations_result_fingerprint_format'
    ) THEN
        ALTER TABLE provider_operations
            ADD CONSTRAINT ck_provider_operations_result_fingerprint_format
            CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64}$')
            NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_provider_operations_completed_has_fingerprint'
    ) THEN
        ALTER TABLE provider_operations
            ADD CONSTRAINT ck_provider_operations_completed_has_fingerprint
            CHECK (
                status <> 'COMPLETED'
                OR (normalized_result_json IS NOT NULL AND result_fingerprint IS NOT NULL)
            )
            NOT VALID;
    END IF;
END $$;
