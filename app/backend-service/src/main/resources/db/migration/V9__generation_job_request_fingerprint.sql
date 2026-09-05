ALTER TABLE generation_jobs
    ADD COLUMN request_fingerprint VARCHAR(64);

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_request_fingerprint
    CHECK (request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$');
