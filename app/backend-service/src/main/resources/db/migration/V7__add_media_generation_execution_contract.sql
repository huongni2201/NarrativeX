-- Media generation execution/review contract. V1-V6 are immutable history.

ALTER TABLE media_plans
    ADD COLUMN IF NOT EXISTS storyboard_revision_id BIGINT REFERENCES storyboard_revisions(id),
    ADD COLUMN IF NOT EXISTS workflow_version VARCHAR(64),
    ADD COLUMN IF NOT EXISTS image_aspect_ratio VARCHAR(16),
    ADD COLUMN IF NOT EXISTS image_quality_tier VARCHAR(16),
    ADD COLUMN IF NOT EXISTS image_provider_key VARCHAR(64),
    ADD COLUMN IF NOT EXISTS image_model_key VARCHAR(128),
    ADD COLUMN IF NOT EXISTS pricing_snapshot_json JSONB,
    ADD COLUMN IF NOT EXISTS pricing_fingerprint VARCHAR(128),
    ADD COLUMN IF NOT EXISTS narration_set_id UUID REFERENCES narration_sets(id),
    ADD COLUMN IF NOT EXISTS narration_alignment_run_id UUID REFERENCES narration_alignment_runs(id);

ALTER TABLE media_plans
    ADD CONSTRAINT ck_media_plans_workflow_version
        CHECK (workflow_version IS NULL OR length(workflow_version) BETWEEN 1 AND 64),
    ADD CONSTRAINT ck_media_plans_image_aspect_ratio
        CHECK (image_aspect_ratio IS NULL OR image_aspect_ratio IN ('16:9', '9:16', '1:1', '4:3', '3:4')),
    ADD CONSTRAINT ck_media_plans_image_quality_tier
        CHECK (image_quality_tier IS NULL OR image_quality_tier IN ('DRAFT', 'STANDARD', 'HIGH')),
    ADD CONSTRAINT ck_media_plans_pricing_snapshot_object
        CHECK (pricing_snapshot_json IS NULL OR jsonb_typeof(pricing_snapshot_json) = 'object'),
    ADD CONSTRAINT ck_media_plans_pricing_fingerprint
        CHECK (pricing_fingerprint IS NULL OR pricing_fingerprint ~ '^[0-9a-f]{64,128}$');

ALTER TABLE media_beat_plans
    ADD COLUMN IF NOT EXISTS asset_strategy VARCHAR(32),
    ADD COLUMN IF NOT EXISTS prompt_template_version VARCHAR(64),
    ADD COLUMN IF NOT EXISTS prompt_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS negative_prompt TEXT,
    ADD COLUMN IF NOT EXISTS audio_start_ms BIGINT,
    ADD COLUMN IF NOT EXISTS audio_end_ms BIGINT,
    ADD COLUMN IF NOT EXISTS audio_duration_ms BIGINT,
    ADD COLUMN IF NOT EXISTS camera_movement VARCHAR(32),
    ADD COLUMN IF NOT EXISTS image_settings_json JSONB,
    ADD COLUMN IF NOT EXISTS character_snapshot_json JSONB,
    ADD COLUMN IF NOT EXISTS snapshot_fingerprint VARCHAR(128);

ALTER TABLE media_beat_plans
    ADD CONSTRAINT ck_media_beat_plans_asset_strategy
        CHECK (asset_strategy IS NULL OR asset_strategy IN ('GENERATE_NEW', 'REUSE_APPROVED', 'REFRAME_DERIVED', 'EDIT_EXISTING')),
    ADD CONSTRAINT ck_media_beat_plans_prompt_snapshot_size
        CHECK (prompt_snapshot IS NULL OR length(prompt_snapshot) <= 16000),
    ADD CONSTRAINT ck_media_beat_plans_audio_range
        CHECK (audio_start_ms IS NULL OR (audio_end_ms IS NOT NULL AND audio_start_ms >= 0 AND audio_end_ms > audio_start_ms)),
    ADD CONSTRAINT ck_media_beat_plans_audio_duration
        CHECK (audio_duration_ms IS NULL OR audio_duration_ms > 0),
    ADD CONSTRAINT ck_media_beat_plans_image_settings_object
        CHECK (image_settings_json IS NULL OR jsonb_typeof(image_settings_json) = 'object'),
    ADD CONSTRAINT ck_media_beat_plans_character_snapshot_object
        CHECK (character_snapshot_json IS NULL OR jsonb_typeof(character_snapshot_json) = 'object'),
    ADD CONSTRAINT ck_media_beat_plans_snapshot_fingerprint
        CHECK (snapshot_fingerprint IS NULL OR snapshot_fingerprint ~ '^[0-9a-f]{64,128}$');

CREATE TABLE media_generation_items (
    id UUID PRIMARY KEY,
    generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    visual_beat_id BIGINT NOT NULL REFERENCES visual_beats(id),
    item_key VARCHAR(160) NOT NULL,
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    execution_status VARCHAR(24) NOT NULL,
    provider_operation_id BIGINT REFERENCES provider_operations(id),
    media_asset_id UUID REFERENCES media_assets(id),
    request_fingerprint VARCHAR(128) NOT NULL,
    error_code VARCHAR(80),
    error_detail_ref VARCHAR(160),
    review_status VARCHAR(24) NOT NULL DEFAULT 'NOT_READY',
    reviewed_by_user_id VARCHAR(128),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_media_generation_items_attempt UNIQUE (generation_job_id, item_key, attempt_number),
    CONSTRAINT ck_media_generation_items_execution_status CHECK (execution_status IN ('QUEUED', 'RUNNING', 'VALIDATING', 'READY', 'FAILED', 'UNKNOWN')),
    CONSTRAINT ck_media_generation_items_review_status CHECK (review_status IN ('NOT_READY', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED')),
    CONSTRAINT ck_media_generation_items_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64,128}$'),
    CONSTRAINT ck_media_generation_items_review_fields CHECK (
        (review_status IN ('NOT_READY', 'NEEDS_REVIEW') AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
        OR (review_status IN ('APPROVED', 'REJECTED') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_media_generation_items_active
    ON media_generation_items (generation_job_id, item_key)
    WHERE execution_status IN ('QUEUED', 'RUNNING', 'VALIDATING', 'READY', 'UNKNOWN');
CREATE INDEX idx_media_generation_items_job_status
    ON media_generation_items (generation_job_id, execution_status, item_key);
CREATE INDEX idx_media_generation_items_beat_newest
    ON media_generation_items (visual_beat_id, attempt_number DESC, created_at DESC);
CREATE INDEX idx_media_generation_items_review_queue
    ON media_generation_items (generation_job_id, review_status, item_key)
    WHERE review_status = 'NEEDS_REVIEW';
CREATE INDEX idx_media_generation_items_provider_operation
    ON media_generation_items (provider_operation_id)
    WHERE provider_operation_id IS NOT NULL;

CREATE TABLE media_asset_lineage (
    id UUID PRIMARY KEY,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    account_id VARCHAR(128) NOT NULL,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    visual_beat_id BIGINT NOT NULL REFERENCES visual_beats(id),
    generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id),
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    generation_item_id UUID NOT NULL REFERENCES media_generation_items(id),
    source_asset_id UUID REFERENCES media_assets(id),
    relation_type VARCHAR(32) NOT NULL,
    request_fingerprint VARCHAR(128) NOT NULL,
    result_fingerprint VARCHAR(128),
    prompt_snapshot TEXT,
    provider_snapshot_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_media_asset_lineage_logical UNIQUE (generation_item_id, relation_type),
    CONSTRAINT ck_media_asset_lineage_relation CHECK (relation_type IN ('GENERATED_KEYFRAME', 'DERIVED_KEYFRAME', 'RENDER_INPUT')),
    CONSTRAINT ck_media_asset_lineage_request_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64,128}$'),
    CONSTRAINT ck_media_asset_lineage_result_fingerprint CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64,128}$'),
    CONSTRAINT ck_media_asset_lineage_provider_snapshot_object CHECK (provider_snapshot_json IS NULL OR jsonb_typeof(provider_snapshot_json) = 'object'),
    CONSTRAINT ck_media_asset_lineage_prompt_snapshot_size CHECK (prompt_snapshot IS NULL OR length(prompt_snapshot) <= 16000)
);
CREATE INDEX idx_media_asset_lineage_asset ON media_asset_lineage (media_asset_id, created_at DESC);
CREATE INDEX idx_media_asset_lineage_project_chapter ON media_asset_lineage (project_id, chapter_id, created_at DESC);
CREATE INDEX idx_media_asset_lineage_beat ON media_asset_lineage (visual_beat_id, created_at DESC);

ALTER TABLE render_manifests
    ADD COLUMN IF NOT EXISTS media_plan_revision INTEGER,
    ADD COLUMN IF NOT EXISTS narration_set_id UUID REFERENCES narration_sets(id),
    ADD COLUMN IF NOT EXISTS narration_alignment_run_id UUID REFERENCES narration_alignment_runs(id),
    ADD COLUMN IF NOT EXISTS project_owner_id VARCHAR(128);

ALTER TABLE render_manifests
    ADD CONSTRAINT ck_render_manifests_media_plan_revision
        CHECK (media_plan_revision IS NULL OR media_plan_revision > 0);
CREATE INDEX idx_render_manifests_project_created
    ON render_manifests (project_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_media_asset_lineage_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'media_asset_lineage is immutable; insert a new lineage row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_asset_lineage_immutable
BEFORE UPDATE OR DELETE ON media_asset_lineage
FOR EACH ROW EXECUTE FUNCTION reject_media_asset_lineage_update();

CREATE OR REPLACE FUNCTION reject_media_generation_item_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.generation_job_id <> NEW.generation_job_id
       OR OLD.media_plan_id <> NEW.media_plan_id
       OR OLD.visual_beat_id <> NEW.visual_beat_id
       OR OLD.item_key <> NEW.item_key
       OR OLD.attempt_number <> NEW.attempt_number
       OR OLD.request_fingerprint <> NEW.request_fingerprint THEN
        RAISE EXCEPTION 'media_generation_items immutable request identity cannot change';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_generation_items_identity_immutable
BEFORE UPDATE ON media_generation_items
FOR EACH ROW EXECUTE FUNCTION reject_media_generation_item_snapshot_update();

