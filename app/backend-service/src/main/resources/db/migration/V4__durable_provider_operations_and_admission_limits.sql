-- Durable provider submission boundary and MVP admission limits.

ALTER TABLE operation_plans
    ADD COLUMN IF NOT EXISTS generation_job_id BIGINT;

ALTER TABLE operation_plans
    ADD CONSTRAINT fk_operation_plan_generation_job
    FOREIGN KEY (generation_job_id) REFERENCES generation_jobs(id);

CREATE INDEX IF NOT EXISTS idx_operation_plans_generation_job
    ON operation_plans (generation_job_id);

ALTER TABLE provider_operations
    ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(128);

UPDATE provider_operations
   SET status = 'COMPLETED'
 WHERE status = 'SUCCEEDED';

ALTER TABLE provider_operations
    ADD CONSTRAINT ck_provider_operations_status
    CHECK (status IN ('RESERVED', 'SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'UNKNOWN'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_operation_fingerprint
    ON provider_operations (provider_key, request_fingerprint);

ALTER TABLE plan_entitlements
    ADD COLUMN IF NOT EXISTS monthly_credits NUMERIC(19, 6);

UPDATE plan_entitlements
   SET monthly_credits = CASE
       WHEN plan_key LIKE '%FREE%' THEN 2.000000
       WHEN plan_key LIKE '%CREATOR%' THEN 10.000000
       WHEN plan_key LIKE '%PRO%' THEN 50.000000
       WHEN plan_key LIKE '%TEAM%' THEN 100.000000
       WHEN plan_key LIKE '%ENTERPRISE%' THEN 1000.000000
       ELSE 0.000000
   END
 WHERE monthly_credits IS NULL;

ALTER TABLE plan_entitlements
    ALTER COLUMN monthly_credits SET NOT NULL;
