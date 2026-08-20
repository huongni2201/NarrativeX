-- Keep a stable fingerprint alongside normalized provider output so a repeated
-- callback can be accepted only when it proves the same result.
ALTER TABLE provider_operations
    ADD COLUMN result_fingerprint VARCHAR(128);

CREATE INDEX idx_provider_operations_result_fingerprint
    ON provider_operations (result_fingerprint)
    WHERE result_fingerprint IS NOT NULL;
