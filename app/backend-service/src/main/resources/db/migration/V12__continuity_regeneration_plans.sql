-- Immutable selective-regeneration plans pinned to one continuity revision.

CREATE TABLE regeneration_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL,
    chapter_id UUID NOT NULL,
    continuity_plan_id UUID NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    requested_beat_ids_json JSONB NOT NULL,
    affected_beat_ids_json JSONB NOT NULL,
    reusable_beat_ids_json JSONB NOT NULL,
    reason VARCHAR(512) NOT NULL,
    estimated_cost NUMERIC(19, 9) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    expires_at TIMESTAMPTZ NOT NULL,
    input_fingerprint VARCHAR(64) NOT NULL,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_regeneration_plan_fingerprint UNIQUE (project_id, chapter_id, input_fingerprint),
    CONSTRAINT uq_regeneration_plan_scope UNIQUE (id, project_id, chapter_id),
    CONSTRAINT ck_regeneration_plan_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_regeneration_plan_fingerprint CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_regeneration_plan_requested_array CHECK (jsonb_typeof(requested_beat_ids_json) = 'array'),
    CONSTRAINT ck_regeneration_plan_affected_array CHECK (jsonb_typeof(affected_beat_ids_json) = 'array'),
    CONSTRAINT ck_regeneration_plan_reusable_array CHECK (jsonb_typeof(reusable_beat_ids_json) = 'array'),
    CONSTRAINT ck_regeneration_plan_cost_nonnegative CHECK (estimated_cost >= 0),
    CONSTRAINT ck_regeneration_plan_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT fk_regeneration_plan_continuity_scope
        FOREIGN KEY (continuity_plan_id, project_id, chapter_id)
        REFERENCES chapter_continuity_plans(id, project_id, chapter_id)
);

ALTER TABLE generation_jobs
    ADD COLUMN regeneration_plan_id UUID REFERENCES regeneration_plans(id),
    ADD CONSTRAINT ck_generation_jobs_regeneration_plan_type CHECK (
        regeneration_plan_id IS NULL OR job_type = 'CHAPTER_GENERATE'
    );

CREATE INDEX idx_regeneration_plans_chapter_created
    ON regeneration_plans (chapter_id, created_at DESC);
CREATE INDEX idx_regeneration_plans_expiry
    ON regeneration_plans (expires_at);

CREATE OR REPLACE FUNCTION reject_regeneration_plan_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'regeneration_plans is immutable; create a new plan instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_regeneration_plans_immutable
BEFORE UPDATE OR DELETE ON regeneration_plans
FOR EACH ROW EXECUTE FUNCTION reject_regeneration_plan_mutation();
