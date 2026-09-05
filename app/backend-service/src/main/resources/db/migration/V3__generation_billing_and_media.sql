-- NarrativeX pre-release baseline: generation execution, billing/quota, and media assets.

-- -----------------------------------------------------------------------------
-- Generation jobs and provider operations
-- -----------------------------------------------------------------------------

CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    job_id UUID NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id),
    job_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    resource_class VARCHAR(32) NOT NULL,
    progress INTEGER NOT NULL,
    current_step VARCHAR(80),
    error_code VARCHAR(80),
    requested_by_user_id VARCHAR(128) NOT NULL,
    billed_to_user_id VARCHAR(128) NOT NULL,
    story_version_id UUID REFERENCES story_versions(id),
    chapter_id UUID REFERENCES chapters(id),
    chapter_row_version BIGINT,
    source_hash VARCHAR(64),
    source_text TEXT,
    source_language VARCHAR(16),
    idempotency_key VARCHAR(512),
    storyboard_revision_id UUID REFERENCES storyboard_revisions(id),
    media_plan_id UUID,
    media_plan_revision INTEGER,
    production_mode VARCHAR(32),
    analysis_visual_generation_mode VARCHAR(16),
    analysis_image_provider VARCHAR(32),
    CONSTRAINT ck_generation_jobs_progress CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT ck_generation_jobs_status CHECK (status IN (
        'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
    )),
    CONSTRAINT ck_generation_jobs_job_type CHECK (job_type IN (
        'CHAPTER_ANALYZE', 'NARRATION_GENERATE', 'CHAPTER_GENERATE', 'RENDER_PROJECT'
    )),
    CONSTRAINT ck_generation_jobs_resource_class CHECK (resource_class IN (
        'PROVIDER_INTERACTIVE', 'PROVIDER_BATCH', 'GPU_HEAVY',
        'CPU_RENDER', 'CPU_LIGHT', 'BACKGROUND', 'NOTIFICATION',
        'FAST_CPU', 'CPU_HEAVY', 'MEDIA_IO'
    )),
    CONSTRAINT ck_generation_jobs_media_plan_pointer CHECK (
        (media_plan_id IS NULL AND media_plan_revision IS NULL AND production_mode IS NULL)
        OR
        (media_plan_id IS NOT NULL AND media_plan_revision IS NOT NULL AND production_mode IS NOT NULL)
    ),
    CONSTRAINT ck_generation_jobs_production_mode CHECK (
        production_mode IS NULL OR production_mode = 'IMAGE_MOTION'
    ),
    CONSTRAINT ck_generation_jobs_analysis_visual_mode CHECK (
        analysis_visual_generation_mode IS NULL
        OR analysis_visual_generation_mode IN ('IMAGE', 'VIDEO')
    ),
    CONSTRAINT ck_generation_jobs_analysis_image_provider CHECK (
        analysis_image_provider IS NULL
        OR analysis_image_provider IN ('GEMINI_WEB', 'API')
    ),
    CONSTRAINT ck_generation_jobs_analysis_preferences_job_type CHECK (
        (analysis_visual_generation_mode IS NULL AND analysis_image_provider IS NULL)
        OR job_type = 'CHAPTER_ANALYZE'
    ),
    CONSTRAINT ck_generation_jobs_analysis_preferences_consistent CHECK (
        (analysis_visual_generation_mode IS NULL AND analysis_image_provider IS NULL)
        OR (analysis_visual_generation_mode = 'IMAGE'
            AND analysis_image_provider IN ('GEMINI_WEB', 'API'))
        OR (analysis_visual_generation_mode = 'VIDEO'
            AND analysis_image_provider IS NULL)
    ),
    CONSTRAINT fk_generation_jobs_media_plan
        FOREIGN KEY (media_plan_id, media_plan_revision, production_mode)
        REFERENCES media_plans(id, revision, production_mode)
);

CREATE TABLE stage_attempts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generation_job_id UUID NOT NULL REFERENCES generation_jobs(id),
    stage_name VARCHAR(64) NOT NULL,
    attempt_number INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    worker_id VARCHAR(128),
    heartbeat_at TIMESTAMP WITH TIME ZONE,
    lease_token UUID,
    CONSTRAINT uk_stage_attempts_job_stage_number UNIQUE (generation_job_id, stage_name, attempt_number),
    CONSTRAINT ck_stage_attempts_status CHECK (status IN (
        'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
    ))
);

CREATE TABLE provider_operations (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    stage_attempt_id UUID NOT NULL REFERENCES stage_attempts(id),
    provider_key VARCHAR(64) NOT NULL,
    provider_operation_id VARCHAR(256),
    status VARCHAR(32) NOT NULL,
    reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_fingerprint VARCHAR(128),
    result_fingerprint VARCHAR(128),
    normalized_result_json JSONB,
    actual_cost NUMERIC(19, 9),
    billing_currency VARCHAR(3),
    usage_json JSONB,
    pricing_snapshot_json JSONB,
    next_reconcile_at TIMESTAMP WITH TIME ZONE,
    reconcile_attempts INTEGER NOT NULL DEFAULT 0,
    last_reconcile_error TEXT,
    CONSTRAINT ck_provider_operations_status CHECK (status IN ('RESERVED', 'SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'UNKNOWN')),
    CONSTRAINT ck_provider_operations_actual_cost_nonnegative CHECK (actual_cost IS NULL OR actual_cost >= 0),
    CONSTRAINT ck_provider_operations_billing_complete CHECK (
        (actual_cost IS NULL AND billing_currency IS NULL AND usage_json IS NULL AND pricing_snapshot_json IS NULL)
        OR
        (actual_cost IS NOT NULL AND billing_currency IS NOT NULL AND usage_json IS NOT NULL AND pricing_snapshot_json IS NOT NULL)
    ),
    CONSTRAINT ck_provider_operations_reconcile_attempts CHECK (reconcile_attempts >= 0),
    CONSTRAINT ck_provider_operations_completed_has_result CHECK (status <> 'COMPLETED' OR normalized_result_json IS NOT NULL),
    CONSTRAINT ck_provider_operations_completed_has_fingerprint CHECK (status <> 'COMPLETED' OR (normalized_result_json IS NOT NULL AND result_fingerprint IS NOT NULL)),
    CONSTRAINT ck_provider_operations_result_fingerprint_format CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64,128}$')
);

CREATE TABLE operation_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    generation_job_id UUID REFERENCES generation_jobs(id),
    operation_type VARCHAR(40) NOT NULL,
    estimate_min NUMERIC(19, 6) NOT NULL,
    estimate_max NUMERIC(19, 6) NOT NULL,
    max_authorized_cost NUMERIC(19, 6) NOT NULL,
    confidence VARCHAR(16) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Plans, usage and quota reservations
-- -----------------------------------------------------------------------------

CREATE TABLE plan_entitlements (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    plan_key VARCHAR(48) NOT NULL,
    version INTEGER NOT NULL,
    watermark_required BOOLEAN NOT NULL,
    max_video_quality VARCHAR(24) NOT NULL,
    max_longform_exports_month INTEGER,
    max_short_exports_month INTEGER,
    max_concurrent_expensive_jobs INTEGER NOT NULL,
    feature_flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    monthly_credits NUMERIC(19, 6),
    active_from TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_plan_entitlements_key_version UNIQUE (plan_key, version)
);

CREATE TABLE user_plan_assignments (
    user_id VARCHAR(128) PRIMARY KEY,
    plan_key VARCHAR(48) NOT NULL,
    entitlement_version INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE usage_windows (
    user_id VARCHAR(128) NOT NULL,
    period_key VARCHAR(32) NOT NULL,
    longform_exports INTEGER NOT NULL DEFAULT 0,
    short_exports INTEGER NOT NULL DEFAULT 0,
    credits_used NUMERIC(19, 9) NOT NULL DEFAULT 0,
    row_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, period_key)
);

CREATE TABLE quota_reservations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP WITH TIME ZONE,
    user_id VARCHAR(128) NOT NULL,
    period_key VARCHAR(32) NOT NULL,
    generation_job_id UUID UNIQUE REFERENCES generation_jobs(id),
    estimated_cost NUMERIC(19, 6) NOT NULL,
    actual_cost NUMERIC(19, 9),
    billing_currency VARCHAR(3),
    status VARCHAR(16) NOT NULL,
    CONSTRAINT ck_quota_reservations_cost_nonnegative CHECK (estimated_cost >= 0),
    CONSTRAINT ck_quota_reservations_actual_cost_nonnegative CHECK (actual_cost IS NULL OR actual_cost >= 0),
    CONSTRAINT ck_quota_reservations_status CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
    CONSTRAINT ck_quota_reservations_finalized CHECK (
        (status = 'RESERVED' AND finalized_at IS NULL)
        OR
        (status IN ('CONSUMED', 'RELEASED') AND finalized_at IS NOT NULL)
    )
);

-- -----------------------------------------------------------------------------
-- Media assets and validation
-- -----------------------------------------------------------------------------

CREATE TABLE media_assets (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    asset_type VARCHAR(16) NOT NULL,
    origin VARCHAR(24) NOT NULL,
    storage_mode VARCHAR(24) NOT NULL DEFAULT 'REMOTE',
    storage_key VARCHAR(512),
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    duration_ms BIGINT,
    status VARCHAR(24) NOT NULL,
    detected_content_type VARCHAR(160),
    detected_container VARCHAR(80),
    detected_codec VARCHAR(80),
    width INTEGER,
    height INTEGER,
    validation_error_code VARCHAR(80),
    validation_error_detail VARCHAR(512),
    validated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    checksum_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_media_assets_type CHECK (asset_type IN ('AUDIO', 'IMAGE', 'VIDEO')),
    CONSTRAINT ck_media_assets_origin CHECK (origin IN ('USER_UPLOAD', 'TTS_GENERATED', 'IMAGE_GENERATED', 'VIDEO_GENERATED', 'LOCAL_ONLY')),
    CONSTRAINT ck_media_assets_storage_scope CHECK (
        (storage_mode = 'REMOTE'
            AND project_id IS NULL
            AND asset_type = 'AUDIO'
            AND storage_key IS NOT NULL)
        OR
        (storage_mode = 'PROJECT_LOCAL'
            AND project_id IS NOT NULL
            AND storage_key IS NOT NULL)
        OR
        (storage_mode = 'LOCAL_ONLY'
            AND project_id IS NOT NULL
            AND storage_key IS NULL)
    ),
    CONSTRAINT ck_media_assets_status CHECK (status IN ('PENDING_UPLOAD', 'UPLOADING', 'VALIDATING', 'READY', 'REJECTED', 'DELETED')),
    CONSTRAINT ck_media_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_media_assets_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_assets_duration CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT uk_media_assets_account_storage_key UNIQUE (account_id, storage_key)
);

-- VisualBeat production preview identity uses canonical MediaAsset IDs. The legacy
-- project_assets preview pointer from V2 is intentionally retired at the media boundary.
ALTER TABLE visual_beats
    DROP COLUMN preview_asset_id,
    ADD COLUMN preview_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

-- Durable non-destructive editor selection for the media used by each VisualBeat.
-- Scene and Chapter remain logical groups; the selected media is resolved when the
-- production timeline/render snapshot is built.
CREATE TABLE production_beat_media_selections (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    fit_mode VARCHAR(24) NOT NULL DEFAULT 'TRIM',
    trim_start_ms BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_production_beat_media_selection UNIQUE (project_id, visual_beat_id),
    CONSTRAINT ck_production_beat_media_selection_fit_mode
        CHECK (fit_mode IN ('TRIM', 'LOOP', 'FREEZE_END', 'SPEED_ADJUST')),
    CONSTRAINT ck_production_beat_media_selection_trim_start CHECK (trim_start_ms >= 0)
);

CREATE TABLE character_version_reference_assets (
    character_version_id UUID NOT NULL REFERENCES character_versions(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    reference_role VARCHAR(24) NOT NULL,
    priority SMALLINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_character_version_reference_assets PRIMARY KEY (character_version_id, media_asset_id),
    CONSTRAINT uq_character_version_reference_priority UNIQUE (character_version_id, priority),
    CONSTRAINT ck_character_version_reference_role CHECK (reference_role IN ('IDENTITY', 'PROFILE', 'EXPRESSION', 'OUTFIT', 'POSE')),
    CONSTRAINT ck_character_version_reference_priority CHECK (priority BETWEEN 0 AND 99)
);

CREATE TABLE media_asset_checksums (
    account_id VARCHAR(128) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    media_asset_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_media_asset_checksums PRIMARY KEY (account_id, sha256),
    CONSTRAINT ck_media_asset_checksums_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT fk_media_asset_checksums_asset
        FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE media_validation_jobs (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    media_asset_id UUID NOT NULL UNIQUE REFERENCES media_assets(id),
    storage_key VARCHAR(512) NOT NULL,
    declared_type VARCHAR(16) NOT NULL,
    declared_content_type VARCHAR(160) NOT NULL,
    expected_size_bytes BIGINT NOT NULL,
    expected_sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    attempts INTEGER NOT NULL DEFAULT 0,
    worker_id VARCHAR(160),
    lease_until TIMESTAMP WITH TIME ZONE,
    lease_token UUID,
    row_version BIGINT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error_code VARCHAR(80),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_media_validation_jobs_type CHECK (declared_type IN ('AUDIO', 'IMAGE', 'VIDEO')),
    CONSTRAINT ck_media_validation_jobs_size CHECK (expected_size_bytes > 0),
    CONSTRAINT ck_media_validation_jobs_sha256 CHECK (expected_sha256 ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT ck_media_validation_jobs_status CHECK (status IN ('QUEUED', 'RUNNING', 'RETRYABLE', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_media_validation_jobs_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_media_validation_jobs_lease_consistency CHECK (
        (status = 'RUNNING' AND worker_id IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
        OR
        (status <> 'RUNNING' AND worker_id IS NULL AND lease_token IS NULL AND lease_until IS NULL)
    )
);

-- Durable structure/shard/repair/audit subcall checkpoints. A completed result is replayable
-- across worker-stage attempts by generation-job + semantic step identity.
CREATE TABLE analysis_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    generation_job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    stage_attempt_id UUID NOT NULL REFERENCES stage_attempts(id) ON DELETE CASCADE,
    step_key VARCHAR(160) NOT NULL,
    input_fingerprint VARCHAR(64) NOT NULL,
    claim_owner VARCHAR(128) NOT NULL,
    lease_version BIGINT NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL,
    result_json JSONB,
    result_hash VARCHAR(64),
    provider_operation_id UUID REFERENCES provider_operations(id),
    CONSTRAINT uq_analysis_checkpoint_identity
        UNIQUE (generation_job_id, step_key, input_fingerprint),
    CONSTRAINT ck_analysis_checkpoint_fingerprint
        CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_analysis_checkpoint_result_hash
        CHECK (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_analysis_checkpoint_status
        CHECK (status IN ('RESERVED', 'RUNNING', 'COMPLETED', 'FAILED', 'UNKNOWN')),
    CONSTRAINT ck_analysis_checkpoint_lease_version CHECK (lease_version > 0),
    CONSTRAINT ck_analysis_checkpoint_terminal_result CHECK (
        (status = 'COMPLETED' AND result_json IS NOT NULL AND result_hash IS NOT NULL AND completed_at IS NOT NULL)
        OR status <> 'COMPLETED'
    )
);
