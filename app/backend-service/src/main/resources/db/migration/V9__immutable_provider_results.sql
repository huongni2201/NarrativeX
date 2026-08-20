-- Make durable provider completion immutable while preserving historical COMPLETED rows.
-- The worker fingerprints the canonical provider-neutral normalized result with SHA-256.

ALTER TABLE provider_operations
    ADD COLUMN IF NOT EXISTS result_fingerprint VARCHAR(64);

ALTER TABLE provider_operations
    ADD CONSTRAINT ck_provider_operations_result_fingerprint_format
    CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64}$')
    NOT VALID;

-- Historical COMPLETED rows may predate result fingerprints. NOT VALID preserves those rows,
-- while PostgreSQL enforces the stronger invariant for every new or subsequently updated row.
ALTER TABLE provider_operations
    ADD CONSTRAINT ck_provider_operations_completed_has_fingerprint
    CHECK (
        status <> 'COMPLETED'
        OR (normalized_result_json IS NOT NULL AND result_fingerprint IS NOT NULL)
    )
    NOT VALID;
