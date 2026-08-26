-- NarrativeX final PostgreSQL/Flyway baseline: relational schema and database logic.
-- Requires PostgreSQL 18+ for the native uuidv7() function.
-- V1 creates tables, constraints, functions and triggers only.
-- V2 creates indexes. V3 inserts deterministic bootstrap/catalog data.

-- -----------------------------------------------------------------------------
-- Authentication
-- -----------------------------------------------------------------------------

CREATE TABLE auth_users (
    id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(160) NOT NULL,
    avatar_url TEXT,
    google_subject VARCHAR(255) UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-authoritative desktop OAuth handoff state.
CREATE TABLE desktop_auth_handoffs (
    code_hash VARCHAR(43) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    code_challenge VARCHAR(43) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Spring Session JDBC schema is owned by Flyway in non-embedded environments.
CREATE TABLE SPRING_SESSION (
    PRIMARY_ID CHAR(36) NOT NULL,
    SESSION_ID CHAR(36) NOT NULL,
    CREATION_TIME BIGINT NOT NULL,
    LAST_ACCESS_TIME BIGINT NOT NULL,
    MAX_INACTIVE_INTERVAL INT NOT NULL,
    EXPIRY_TIME BIGINT NOT NULL,
    PRINCIPAL_NAME VARCHAR(128),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE TABLE SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36) NOT NULL,
    ATTRIBUTE_NAME VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES BYTEA NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK
        FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION(PRIMARY_ID)
        ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Local execution devices
-- -----------------------------------------------------------------------------

CREATE TABLE local_device_pairing_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE local_devices (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(160) NOT NULL,
    platform VARCHAR(80) NOT NULL,
    agent_version VARCHAR(64) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    last_seen_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE local_device_capabilities (
    device_id UUID NOT NULL REFERENCES local_devices(id) ON DELETE CASCADE,
    capability VARCHAR(64) NOT NULL,
    PRIMARY KEY (device_id, capability)
);

-- Stable guest identities for NarrativeX Desktop installations.
-- The guest principal remains an internal auth row only; Google is still the only
-- persisted end-user login provider. Installation secrets are stored as SHA-256 hashes.
CREATE TABLE desktop_guest_installations (
    device_id UUID PRIMARY KEY,
    guest_user_id VARCHAR(128) NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
    secret_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_desktop_guest_installations_secret_hash
        CHECK (secret_hash ~ '^[0-9a-f]{64}$')
);

-- -----------------------------------------------------------------------------
-- Projects, stories, chapters and storyboard revisions
-- -----------------------------------------------------------------------------

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    cover_image_url VARCHAR(1024),
    owner_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    source_language VARCHAR(16) NOT NULL,
    narration_language VARCHAR(16) NOT NULL,
    metadata_language VARCHAR(16) NOT NULL,
    image_aspect_ratio VARCHAR(16) NOT NULL,
    image_quality_tier VARCHAR(16) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_projects_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE TABLE project_favorites (
    user_id VARCHAR(128) NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_favorites PRIMARY KEY (user_id, project_id)
);

CREATE TABLE story_versions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    source_language VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    CONSTRAINT uk_story_versions_project_version UNIQUE (project_id, version_number),
    CONSTRAINT ck_story_versions_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED'))
);

CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    story_version_id UUID NOT NULL REFERENCES story_versions(id),
    order_index INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    source_text TEXT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    estimated_duration_ms BIGINT,
    generation_progress INTEGER NOT NULL DEFAULT 0,
    source_story_version_id UUID REFERENCES story_versions(id),
    inherited_snapshot_hash VARCHAR(128),
    current_storyboard_revision_id UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_chapters_source_hash_sha256 CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE chapter_creation_idempotency (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_id VARCHAR(128) NOT NULL REFERENCES auth_users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    idempotency_key VARCHAR(200) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    chapter_id UUID REFERENCES chapters(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_chapter_creation_idempotency UNIQUE (owner_id, project_id, idempotency_key),
    CONSTRAINT ck_chapter_creation_idempotency_fingerprint
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE TABLE storyboard_revisions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    revision_number INTEGER NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    source_row_version BIGINT NOT NULL,
    based_on_revision_id UUID REFERENCES storyboard_revisions(id),
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    CONSTRAINT uk_storyboard_revisions_chapter_number UNIQUE (chapter_id, revision_number),
    CONSTRAINT ck_storyboard_revisions_status CHECK (status IN ('DRAFT', 'FAILED')),
    CONSTRAINT ck_storyboard_revisions_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

ALTER TABLE chapters
    ADD CONSTRAINT fk_chapters_current_storyboard_revision
    FOREIGN KEY (current_storyboard_revision_id) REFERENCES storyboard_revisions(id);

-- -----------------------------------------------------------------------------
-- Reusable characters, locations and project assets
-- -----------------------------------------------------------------------------

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_id VARCHAR(128) NOT NULL,
    workspace_id VARCHAR(128),
    canonical_name VARCHAR(160) NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE character_versions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    character_id UUID NOT NULL REFERENCES characters(id),
    version_number INTEGER NOT NULL,
    bible TEXT NOT NULL,
    visual_prompt TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(128),
    CONSTRAINT uk_character_versions_character_version UNIQUE (character_id, version_number)
);

CREATE TABLE outfit_versions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    character_id UUID NOT NULL REFERENCES characters(id),
    version_number INTEGER NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    prompt TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    CONSTRAINT uk_outfit_versions_character_version UNIQUE (character_id, version_number),
    CONSTRAINT uk_outfit_versions_id_character UNIQUE (id, character_id)
);

CREATE TABLE character_appearances (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    character_id UUID NOT NULL REFERENCES characters(id),
    project_id UUID REFERENCES projects(id),
    timeline_key VARCHAR(128) NOT NULL,
    age_state TEXT,
    hairstyle TEXT,
    injury TEXT,
    wardrobe_context TEXT,
    appearance_prompt TEXT,
    outfit_version_id UUID,
    CONSTRAINT fk_character_appearances_outfit_character
        FOREIGN KEY (outfit_version_id, character_id)
        REFERENCES outfit_versions (id, character_id)
);

CREATE TABLE project_characters (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    character_id UUID NOT NULL REFERENCES characters(id),
    role VARCHAR(64) NOT NULL,
    importance INTEGER NOT NULL DEFAULT 0,
    project_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    story_metadata TEXT,
    groups_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    pinned_character_version_id UUID REFERENCES character_versions(id),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uk_project_characters_project_character UNIQUE (project_id, character_id),
    CONSTRAINT uk_project_characters_project_id_id UNIQUE (project_id, id),
    CONSTRAINT ck_project_characters_importance_nonnegative CHECK (importance >= 0)
);

CREATE TABLE project_locations (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    visual_prompt TEXT,
    reference_image_url TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uk_project_locations_project_id_id UNIQUE (project_id, id),
    CONSTRAINT ck_project_locations_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE TABLE project_assets (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    asset_type VARCHAR(32) NOT NULL,
    storage_key VARCHAR(512),
    url TEXT,
    mime_type VARCHAR(160),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ck_project_assets_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_project_assets_type CHECK (asset_type IN ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER'))
);

CREATE TABLE project_character_ai_identities (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ai_key VARCHAR(64) NOT NULL,
    project_character_id UUID NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    last_seen_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    match_basis VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_character_ai_identities PRIMARY KEY (project_id, ai_key),
    CONSTRAINT fk_project_character_ai_identity_entity
        FOREIGN KEY (project_id, project_character_id)
        REFERENCES project_characters(project_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_project_character_ai_identity_key
        CHECK (ai_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_project_character_ai_identity_match_basis
        CHECK (match_basis IN ('EXACT_KEY', 'ALIAS', 'OBSERVATION', 'CANDIDATE', 'CREATED')),
    CONSTRAINT ck_project_character_ai_identity_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE project_location_ai_identities (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ai_key VARCHAR(64) NOT NULL,
    project_location_id UUID NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    last_seen_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    match_basis VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_location_ai_identities PRIMARY KEY (project_id, ai_key),
    CONSTRAINT fk_project_location_ai_identity_entity
        FOREIGN KEY (project_id, project_location_id)
        REFERENCES project_locations(project_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_project_location_ai_identity_key
        CHECK (ai_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_project_location_ai_identity_match_basis
        CHECK (match_basis IN ('EXACT_KEY', 'ALIAS', 'OBSERVATION', 'CANDIDATE', 'CREATED')),
    CONSTRAINT ck_project_location_ai_identity_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- -----------------------------------------------------------------------------
-- Scenes and visual beats
-- -----------------------------------------------------------------------------

CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    storyboard_revision_id UUID NOT NULL REFERENCES storyboard_revisions(id),
    order_index INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    narration TEXT,
    duration_seconds INTEGER,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    project_location_id UUID REFERENCES project_locations(id) ON DELETE SET NULL,
    CONSTRAINT uk_scenes_revision_order UNIQUE (storyboard_revision_id, order_index)
);

CREATE TABLE scene_characters (
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    project_character_id UUID NOT NULL REFERENCES project_characters(id),
    CONSTRAINT pk_scene_characters PRIMARY KEY (scene_id, project_character_id),
    CONSTRAINT uk_scene_characters_scene_order UNIQUE (scene_id, order_index),
    CONSTRAINT ck_scene_characters_order_nonnegative CHECK (order_index >= 0)
);

CREATE TABLE visual_beats (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scene_id UUID NOT NULL REFERENCES scenes(id),
    order_index INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    visual_intent TEXT NOT NULL,
    review_status VARCHAR(24) NOT NULL DEFAULT 'NEEDS_REVIEW',
    motion_mode VARCHAR(24) NOT NULL DEFAULT 'STILL',
    camera_movement VARCHAR(32) NOT NULL DEFAULT 'NONE',
    aspect_ratio_override VARCHAR(16),
    quality_tier_override VARCHAR(16),
    text_start INTEGER,
    text_end INTEGER,
    audio_start_ms BIGINT,
    audio_end_ms BIGINT,
    camera_angle VARCHAR(40),
    preview_asset_id UUID REFERENCES project_assets(id) ON DELETE SET NULL,
    CONSTRAINT uk_visual_beats_scene_order UNIQUE (scene_id, order_index),
    CONSTRAINT ck_visual_beats_review_status CHECK (review_status IN ('NEEDS_REVIEW', 'APPROVED')),
    CONSTRAINT ck_visual_beats_motion_mode CHECK (motion_mode IN ('STILL', 'BASIC_MOTION', 'AI_VIDEO')),
    CONSTRAINT ck_visual_beats_camera_movement CHECK (
        camera_movement IN ('NONE', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK', 'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX')
    ),
    CONSTRAINT ck_visual_beats_text_start_nonnegative CHECK (text_start IS NULL OR text_start >= 0),
    CONSTRAINT ck_visual_beats_text_range CHECK (text_end IS NULL OR (text_start IS NOT NULL AND text_end >= text_start)),
    CONSTRAINT ck_visual_beats_audio_start_nonnegative CHECK (audio_start_ms IS NULL OR audio_start_ms >= 0),
    CONSTRAINT ck_visual_beats_audio_range CHECK (audio_end_ms IS NULL OR (audio_start_ms IS NOT NULL AND audio_end_ms >= audio_start_ms)),
    CONSTRAINT ck_visual_beats_camera_angle CHECK (
        camera_angle IS NULL OR camera_angle IN (
            'WIDE', 'MEDIUM', 'CLOSE_UP', 'EXTREME_CLOSE_UP', 'LOW_ANGLE',
            'HIGH_ANGLE', 'OVER_THE_SHOULDER', 'POV'
        )
    )
);

CREATE TABLE visual_beat_characters (
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    project_character_id UUID NOT NULL REFERENCES project_characters(id) ON DELETE CASCADE,
    role VARCHAR(24) NOT NULL DEFAULT 'SECONDARY',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_visual_beat_characters PRIMARY KEY (visual_beat_id, project_character_id),
    CONSTRAINT ck_visual_beat_characters_role CHECK (role IN ('PRIMARY', 'SECONDARY', 'BACKGROUND'))
);

-- -----------------------------------------------------------------------------
-- Backend-authoritative media plans
-- -----------------------------------------------------------------------------

CREATE TABLE media_plans (
    id UUID PRIMARY KEY,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    chapter_row_version BIGINT NOT NULL CHECK (chapter_row_version >= 0),
    source_hash VARCHAR(64) NOT NULL,
    production_mode VARCHAR(32) NOT NULL CHECK (production_mode IN ('IMAGE_MOTION', 'HYBRID_LOCAL_I2V')),
    revision INTEGER NOT NULL CHECK (revision > 0),
    narration_characters BIGINT NOT NULL CHECK (narration_characters >= 0),
    image_generate_count INTEGER NOT NULL CHECK (image_generate_count >= 0),
    image_edit_count INTEGER NOT NULL CHECK (image_edit_count >= 0),
    basic_motion_seconds INTEGER NOT NULL CHECK (basic_motion_seconds >= 0),
    planned_i2v_seconds INTEGER NOT NULL CHECK (planned_i2v_seconds >= 0),
    estimated_cost NUMERIC(19, 6) NOT NULL CHECK (estimated_cost >= 0),
    storyboard_revision_id UUID REFERENCES storyboard_revisions(id),
    workflow_version VARCHAR(64),
    image_aspect_ratio VARCHAR(16),
    image_quality_tier VARCHAR(16),
    image_provider_key VARCHAR(64),
    image_model_key VARCHAR(128),
    pricing_snapshot_json JSONB,
    pricing_fingerprint VARCHAR(128),
    narration_set_id UUID,
    narration_alignment_run_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_media_plans_chapter_revision UNIQUE (chapter_id, revision),
    CONSTRAINT uq_media_plans_job_pointer UNIQUE (id, revision, production_mode),
    CONSTRAINT ck_media_plans_workflow_version CHECK (workflow_version IS NULL OR length(workflow_version) BETWEEN 1 AND 64),
    CONSTRAINT ck_media_plans_image_aspect_ratio CHECK (image_aspect_ratio IS NULL OR image_aspect_ratio IN ('16:9', '9:16', '1:1', '4:3', '3:4')),
    CONSTRAINT ck_media_plans_image_quality_tier CHECK (image_quality_tier IS NULL OR image_quality_tier IN ('DRAFT', 'STANDARD', 'HIGH')),
    CONSTRAINT ck_media_plans_pricing_snapshot_object CHECK (pricing_snapshot_json IS NULL OR jsonb_typeof(pricing_snapshot_json) = 'object'),
    CONSTRAINT ck_media_plans_pricing_fingerprint CHECK (pricing_fingerprint IS NULL OR pricing_fingerprint ~ '^[0-9a-f]{64,128}$')
);

CREATE TABLE media_scene_plans (
    media_plan_id UUID NOT NULL REFERENCES media_plans(id) ON DELETE CASCADE,
    scene_index INTEGER NOT NULL CHECK (scene_index >= 0),
    scene_id UUID NOT NULL,
    scene_order_index INTEGER NOT NULL CHECK (scene_order_index >= 0),
    narration TEXT,
    duration_seconds INTEGER CHECK (duration_seconds >= 0),
    PRIMARY KEY (media_plan_id, scene_index)
);

CREATE TABLE media_beat_plans (
    media_plan_id UUID NOT NULL,
    scene_index INTEGER NOT NULL,
    beat_index INTEGER NOT NULL CHECK (beat_index >= 0),
    visual_beat_id UUID NOT NULL,
    visual_beat_order_index INTEGER NOT NULL CHECK (visual_beat_order_index >= 0),
    visual_intent TEXT NOT NULL,
    semantic_motion_mode VARCHAR(32) NOT NULL CHECK (semantic_motion_mode IN ('STILL', 'BASIC_MOTION', 'AI_VIDEO')),
    motion_strategy VARCHAR(32) NOT NULL CHECK (motion_strategy IN ('BASIC_IMAGE_MOTION', 'IMAGE_TO_VIDEO')),
    asset_strategy VARCHAR(32),
    reuse_source_visual_beat_id UUID,
    prompt_template_version VARCHAR(64),
    prompt_snapshot TEXT,
    negative_prompt TEXT,
    audio_start_ms BIGINT,
    audio_end_ms BIGINT,
    audio_duration_ms BIGINT,
    camera_movement VARCHAR(32),
    image_settings_json JSONB,
    character_snapshot_json JSONB,
    snapshot_fingerprint VARCHAR(128),
    PRIMARY KEY (media_plan_id, scene_index, beat_index),
    CONSTRAINT fk_media_beat_plan_scene
        FOREIGN KEY (media_plan_id, scene_index)
        REFERENCES media_scene_plans(media_plan_id, scene_index)
        ON DELETE CASCADE,
    CONSTRAINT ck_media_beat_plans_asset_strategy
        CHECK (asset_strategy IS NULL OR asset_strategy IN ('GENERATE_NEW', 'REUSE_APPROVED', 'REFRAME_DERIVED', 'EDIT_EXISTING')),
    CONSTRAINT ck_media_beat_plans_reuse_source_strategy
        CHECK (
            (asset_strategy IN ('REUSE_APPROVED', 'REFRAME_DERIVED') AND reuse_source_visual_beat_id IS NOT NULL)
            OR
            (asset_strategy NOT IN ('REUSE_APPROVED', 'REFRAME_DERIVED') AND reuse_source_visual_beat_id IS NULL)
        ),
    CONSTRAINT ck_media_beat_plans_reuse_source_not_self
        CHECK (reuse_source_visual_beat_id IS NULL OR reuse_source_visual_beat_id <> visual_beat_id),
    CONSTRAINT ck_media_beat_plans_prompt_snapshot_size CHECK (prompt_snapshot IS NULL OR length(prompt_snapshot) <= 16000),
    CONSTRAINT ck_media_beat_plans_audio_range CHECK (audio_start_ms IS NULL OR (audio_end_ms IS NOT NULL AND audio_start_ms >= 0 AND audio_end_ms > audio_start_ms)),
    CONSTRAINT ck_media_beat_plans_audio_duration CHECK (audio_duration_ms IS NULL OR audio_duration_ms > 0),
    CONSTRAINT ck_media_beat_plans_image_settings_object CHECK (image_settings_json IS NULL OR jsonb_typeof(image_settings_json) = 'object'),
    CONSTRAINT ck_media_beat_plans_character_snapshot_object CHECK (character_snapshot_json IS NULL OR jsonb_typeof(character_snapshot_json) = 'object'),
    CONSTRAINT ck_media_beat_plans_snapshot_fingerprint CHECK (snapshot_fingerprint IS NULL OR snapshot_fingerprint ~ '^[0-9a-f]{64,128}$')
);

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
    CONSTRAINT ck_generation_jobs_progress CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT ck_generation_jobs_status CHECK (status IN (
        'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
    )),
    CONSTRAINT ck_generation_jobs_job_type CHECK (job_type IN (
        'STORY_ANALYZE', 'CHAPTER_ANALYZE', 'NARRATION_GENERATE', 'IMAGE_GENERATE',
        'CHAPTER_GENERATE', 'CHAPTER_RENDER', 'PROJECT_CONTINUE', 'VISUAL_BEAT_PLAN',
        'SHOT_IMAGE_GENERATE', 'RENDER_PROJECT', 'RENDER_SHORT'
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
        production_mode IS NULL OR production_mode IN ('IMAGE_MOTION', 'HYBRID_LOCAL_I2V')
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
    CONSTRAINT ck_media_assets_storage_mode CHECK ((storage_mode IN ('REMOTE', 'HYBRID') AND storage_key IS NOT NULL) OR (storage_mode = 'LOCAL_ONLY' AND storage_key IS NULL)),
    CONSTRAINT ck_media_assets_status CHECK (status IN ('PENDING_UPLOAD', 'UPLOADING', 'VALIDATING', 'READY', 'REJECTED', 'DELETED')),
    CONSTRAINT ck_media_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_media_assets_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_assets_duration CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT uk_media_assets_account_storage_key UNIQUE (account_id, storage_key)
);

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

-- Server-side registry of which paired desktop device currently has a materialized
-- local copy. Absolute filesystem paths stay on the desktop and are never persisted here.
CREATE TABLE local_media_materializations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    local_device_id UUID NOT NULL REFERENCES local_devices(id) ON DELETE CASCADE,
    state VARCHAR(16) NOT NULL,
    size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_local_media_materializations UNIQUE (project_id, media_asset_id, local_device_id),
    CONSTRAINT ck_local_media_materializations_state CHECK (state IN ('AVAILABLE', 'MISSING', 'CORRUPT')),
    CONSTRAINT ck_local_media_materializations_checksum CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$')
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

-- -----------------------------------------------------------------------------
-- Narration and alignment
-- -----------------------------------------------------------------------------

CREATE TABLE narration_requests (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    chapter_row_version BIGINT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    source_text TEXT NOT NULL,
    voice_id VARCHAR(160) NOT NULL,
    language VARCHAR(16) NOT NULL,
    speaking_rate NUMERIC(8, 4) NOT NULL,
    segmentation_version VARCHAR(64) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    voice_reference_asset_id UUID REFERENCES media_assets(id),
    CONSTRAINT uk_narration_requests_fingerprint UNIQUE (request_fingerprint),
    CONSTRAINT ck_narration_requests_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_requests_speaking_rate CHECK (speaking_rate > 0)
);

CREATE TABLE narration_operations (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    narration_request_id UUID NOT NULL REFERENCES narration_requests(id),
    generation_job_id UUID NOT NULL UNIQUE REFERENCES generation_jobs(id),
    stage_attempt_id UUID NOT NULL UNIQUE REFERENCES stage_attempts(id),
    CONSTRAINT uk_narration_operations_request_job UNIQUE (narration_request_id, generation_job_id)
);

CREATE TABLE narration_assets (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    narration_request_id UUID NOT NULL UNIQUE REFERENCES narration_requests(id),
    project_asset_id UUID NOT NULL UNIQUE REFERENCES project_assets(id),
    duration_ms BIGINT NOT NULL,
    size_bytes BIGINT NOT NULL,
    codec VARCHAR(32) NOT NULL,
    sample_rate_hz INTEGER NOT NULL,
    channels INTEGER NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    CONSTRAINT ck_narration_assets_duration CHECK (duration_ms > 0),
    CONSTRAINT ck_narration_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_narration_assets_sample_rate CHECK (sample_rate_hz > 0),
    CONSTRAINT ck_narration_assets_channels CHECK (channels > 0),
    CONSTRAINT ck_narration_assets_checksum CHECK (checksum ~ '^[0-9a-f]{64}$')
);

CREATE TABLE narration_alignments (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    narration_asset_id UUID NOT NULL REFERENCES narration_assets(id),
    source_hash VARCHAR(64) NOT NULL,
    alignment_version VARCHAR(64) NOT NULL,
    spans_json JSONB NOT NULL,
    CONSTRAINT uk_narration_alignments_asset_version UNIQUE (narration_asset_id, alignment_version),
    CONSTRAINT ck_narration_alignments_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_alignments_spans_array CHECK (jsonb_typeof(spans_json) = 'array')
);

CREATE TABLE narration_sets (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    source VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL,
    narration_fingerprint VARCHAR(64) NOT NULL,
    total_duration_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_sets_source CHECK (source IN ('TTS', 'USER_PROVIDED_AUDIO')),
    CONSTRAINT ck_narration_sets_status CHECK (status IN ('DRAFT', 'READY', 'NEEDS_USER_ACTION', 'REJECTED')),
    CONSTRAINT ck_narration_sets_duration CHECK (total_duration_ms >= 0),
    CONSTRAINT ck_narration_sets_fingerprint CHECK (narration_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE TABLE narration_parts (
    id UUID PRIMARY KEY,
    narration_set_id UUID NOT NULL REFERENCES narration_sets(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    sequence INTEGER NOT NULL,
    duration_ms BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_parts_sequence CHECK (sequence >= 0),
    CONSTRAINT ck_narration_parts_duration CHECK (duration_ms > 0),
    CONSTRAINT ck_narration_parts_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uk_narration_parts_set_sequence UNIQUE (narration_set_id, sequence),
    CONSTRAINT uk_narration_parts_set_asset UNIQUE (narration_set_id, media_asset_id)
);

CREATE TABLE narration_documents (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    document_fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_documents_fingerprint CHECK (document_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uk_narration_documents_story_fingerprint UNIQUE (story_id, document_fingerprint)
);

CREATE TABLE narration_document_chapters (
    narration_document_id UUID NOT NULL REFERENCES narration_documents(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL,
    chapter_revision_id UUID NOT NULL,
    sequence INTEGER NOT NULL,
    global_text_start INTEGER NOT NULL,
    global_text_end INTEGER NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    row_version BIGINT NOT NULL,
    PRIMARY KEY (narration_document_id, sequence),
    CONSTRAINT ck_narration_document_chapters_sequence CHECK (sequence >= 0),
    CONSTRAINT ck_narration_document_chapters_offsets CHECK (global_text_start >= 0 AND global_text_end >= global_text_start),
    CONSTRAINT ck_narration_document_chapters_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_document_chapters_row_version CHECK (row_version >= 0),
    CONSTRAINT uk_narration_document_chapters_revision UNIQUE (narration_document_id, chapter_revision_id)
);

CREATE TABLE narration_alignment_runs (
    id UUID PRIMARY KEY,
    narration_document_id UUID NOT NULL REFERENCES narration_documents(id),
    narration_set_id UUID NOT NULL REFERENCES narration_sets(id),
    document_fingerprint VARCHAR(64) NOT NULL,
    narration_fingerprint VARCHAR(64) NOT NULL,
    provider VARCHAR(128) NOT NULL,
    provider_version VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    coverage NUMERIC(6, 5) NOT NULL,
    confidence NUMERIC(6, 5) NOT NULL,
    spans_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_alignment_runs_status CHECK (status IN ('READY', 'LOW_CONFIDENCE', 'INCOMPLETE', 'GAP_DETECTED', 'EXTRA_AUDIO', 'FAILED')),
    CONSTRAINT ck_narration_alignment_runs_coverage CHECK (coverage >= 0 AND coverage <= 1),
    CONSTRAINT ck_narration_alignment_runs_confidence CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT ck_narration_alignment_runs_document_hash CHECK (document_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_alignment_runs_narration_hash CHECK (narration_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_alignment_runs_spans_array CHECK (jsonb_typeof(spans_json) = 'array'),
    CONSTRAINT uk_narration_alignment_runs_cache UNIQUE (document_fingerprint, narration_fingerprint, provider, provider_version)
);

ALTER TABLE media_plans
    ADD CONSTRAINT fk_media_plans_narration_set
        FOREIGN KEY (narration_set_id) REFERENCES narration_sets(id),
    ADD CONSTRAINT fk_media_plans_narration_alignment_run
        FOREIGN KEY (narration_alignment_run_id) REFERENCES narration_alignment_runs(id);

-- -----------------------------------------------------------------------------
-- Notifications and durable outbox
-- -----------------------------------------------------------------------------

CREATE TABLE notifications (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    project_id UUID REFERENCES projects(id),
    event_key VARCHAR(160) NOT NULL UNIQUE,
    type VARCHAR(48) NOT NULL,
    channel_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    title_key VARCHAR(128) NOT NULL,
    message_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE outbox_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    event_key VARCHAR(160) NOT NULL UNIQUE,
    payload_json JSONB NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Render manifests, final artifacts and short clips
-- -----------------------------------------------------------------------------

CREATE TABLE render_manifests (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    media_plan_id UUID REFERENCES media_plans(id),
    chapter_row_version BIGINT NOT NULL CHECK (chapter_row_version >= 0),
    source_hash VARCHAR(64) NOT NULL,
    render_fingerprint VARCHAR(64) NOT NULL,
    manifest_json JSONB NOT NULL,
    media_plan_revision INTEGER,
    narration_set_id UUID REFERENCES narration_sets(id),
    narration_alignment_run_id UUID REFERENCES narration_alignment_runs(id),
    project_owner_id VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_render_manifests_fingerprint UNIQUE (render_fingerprint),
    CONSTRAINT ck_render_manifests_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_render_manifests_fingerprint CHECK (render_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_render_manifests_media_plan_revision CHECK (media_plan_revision IS NULL OR media_plan_revision > 0)
);

CREATE TABLE final_artifacts (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
    render_manifest_id UUID REFERENCES render_manifests(id) ON DELETE SET NULL,
    artifact_type VARCHAR(32) NOT NULL,
    render_fingerprint VARCHAR(64) NOT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    mime_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    duration_ms BIGINT,
    width INTEGER,
    height INTEGER,
    fps NUMERIC(8,3),
    status VARCHAR(24) NOT NULL DEFAULT 'READY',
    storage_provider VARCHAR(32) NOT NULL DEFAULT 'R2',
    external_file_id VARCHAR(255),
    web_view_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_final_artifacts_type CHECK (artifact_type IN ('CHAPTER_VIDEO', 'PROJECT_VIDEO', 'SHORT_VIDEO')),
    CONSTRAINT ck_final_artifacts_status CHECK (status IN ('PENDING', 'READY', 'FAILED', 'ARCHIVED')),
    CONSTRAINT ck_final_artifacts_fingerprint CHECK (render_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_final_artifacts_checksum CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_final_artifacts_size_nonnegative CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT ck_final_artifacts_duration_nonnegative CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT ck_final_artifacts_dimensions_positive CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0)),
    CONSTRAINT ck_final_artifacts_fps_positive CHECK (fps IS NULL OR fps > 0)
);

CREATE TABLE short_clip_requests (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    source_final_artifact_id BIGINT NOT NULL REFERENCES final_artifacts(id),
    generation_job_id UUID NOT NULL UNIQUE REFERENCES generation_jobs(id) ON DELETE CASCADE,
    start_ms BIGINT NOT NULL,
    end_ms BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    output_final_artifact_id BIGINT REFERENCES final_artifacts(id),
    request_fingerprint VARCHAR(64) NOT NULL UNIQUE,
    worker_id VARCHAR(160),
    heartbeat_at TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(80),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_short_clip_range CHECK (start_ms >= 0 AND end_ms > start_ms),
    CONSTRAINT ck_short_clip_status CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_short_clip_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_short_clip_output_state CHECK (
        (status = 'COMPLETED' AND output_final_artifact_id IS NOT NULL)
        OR
        (status <> 'COMPLETED' AND output_final_artifact_id IS NULL)
    )
);

-- -----------------------------------------------------------------------------
-- Catalog read models and upload lifecycle
-- -----------------------------------------------------------------------------

CREATE TABLE style_presets (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    thumbnail_url TEXT,
    prompt_suffix TEXT,
    negative_prompt TEXT,
    tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(128) REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT ck_style_presets_category CHECK (category IN ('VISUAL_STYLE', 'IMAGE', 'MOTION', 'OUTFIT', 'RENDER')),
    CONSTRAINT ck_style_presets_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_style_presets_tags_array CHECK (jsonb_typeof(tags_json) = 'array'),
    CONSTRAINT ck_style_presets_config_object CHECK (jsonb_typeof(config_json) = 'object')
);

CREATE TABLE voice_catalog (
    id VARCHAR(160) PRIMARY KEY,
    provider VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    language VARCHAR(32) NOT NULL,
    gender VARCHAR(24),
    sample_url TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_voice_catalog_metadata_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE TABLE media_upload_sessions (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    asset_type VARCHAR(16) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    expected_size BIGINT NOT NULL,
    expected_sha256 VARCHAR(64) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    idempotency_key VARCHAR(255),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_UPLOAD',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    media_asset_id UUID REFERENCES media_assets(id),
    CONSTRAINT ck_media_upload_sessions_type CHECK (asset_type IN ('AUDIO', 'IMAGE', 'VIDEO')),
    CONSTRAINT ck_media_upload_sessions_size CHECK (expected_size > 0),
    CONSTRAINT ck_media_upload_sessions_sha256 CHECK (expected_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_upload_sessions_status CHECK (status IN ('PENDING_UPLOAD', 'VALIDATING', 'READY', 'REJECTED')),
    CONSTRAINT uk_media_upload_sessions_storage_key UNIQUE (storage_key),
    CONSTRAINT uk_media_upload_sessions_idempotency UNIQUE (account_id, idempotency_key)
);

CREATE TABLE media_storage_cleanup_tasks (
    id UUID PRIMARY KEY,
    storage_key VARCHAR(512) NOT NULL,
    reason VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_error VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_media_storage_cleanup_status CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED')),
    CONSTRAINT ck_media_storage_cleanup_attempts CHECK (attempt_count >= 0)
);

-- -----------------------------------------------------------------------------
-- Media generation execution and lineage
-- -----------------------------------------------------------------------------

CREATE TABLE media_generation_items (
    id UUID PRIMARY KEY,
    generation_job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id),
    item_key VARCHAR(160) NOT NULL,
    attempt_number INTEGER NOT NULL,
    execution_status VARCHAR(24) NOT NULL,
    provider_operation_id UUID REFERENCES provider_operations(id),
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
    CONSTRAINT ck_media_generation_items_attempt CHECK (attempt_number > 0),
    CONSTRAINT ck_media_generation_items_execution_status CHECK (execution_status IN ('QUEUED', 'RUNNING', 'VALIDATING', 'READY', 'FAILED', 'UNKNOWN')),
    CONSTRAINT ck_media_generation_items_review_status CHECK (review_status IN ('NOT_READY', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED')),
    CONSTRAINT ck_media_generation_items_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64,128}$'),
    CONSTRAINT ck_media_generation_items_review_fields CHECK (
        (review_status IN ('NOT_READY', 'NEEDS_REVIEW') AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
        OR
        (review_status IN ('APPROVED', 'REJECTED') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE TABLE media_asset_lineage (
    id UUID PRIMARY KEY,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    account_id VARCHAR(128) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id),
    generation_job_id UUID NOT NULL REFERENCES generation_jobs(id),
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

-- -----------------------------------------------------------------------------
-- Chapter render admission snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE render_input_snapshots (
    generation_job_id UUID PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    media_plan_revision INTEGER NOT NULL CHECK (media_plan_revision > 0),
    render_profile_json JSONB NOT NULL DEFAULT '{
      "schemaVersion": 1,
      "engine": "ffmpeg-python",
      "rendererVersion": "image-motion-v6-profiled-cinematic",
      "fps": 30,
      "video": {
        "encoder": "libx264",
        "x264Preset": "veryfast",
        "crf": 20,
        "nvencPreset": "p5",
        "nvencCq": 21,
        "pixelFormat": "yuv420p"
      },
      "audio": {
        "codec": "aac",
        "bitrate": "192k",
        "sampleRate": 48000
      },
      "effects": {
        "transition": "LEGACY_FADE",
        "transitionSeconds": 0.12,
        "colorGrade": "NONE",
        "backgroundMode": "COVER",
        "backgroundBlurSigma": 22.0,
        "overlayStyle": "NONE",
        "overlayOpacity": 0.30,
        "watermarkWidthRatio": 0.12,
        "watermarkOpacity": 0.82,
        "watermarkPosition": "TOP_RIGHT",
        "bgmVolume": 0.18,
        "duckThreshold": 0.08,
        "duckRatio": 8.0,
        "duckAttackMs": 20.0,
        "duckReleaseMs": 350.0,
        "motionEasing": "LINEAR",
        "textOverlays": [],
        "lutAsset": null,
        "overlayAsset": null,
        "watermarkAsset": null,
        "bgmAsset": null
      },
      "subtitles": {"mode": "burned-ass"}
    }'::jsonb,
    narration_request_id UUID REFERENCES narration_requests(id),
    narration_asset_id UUID REFERENCES narration_assets(id),
    narration_alignment_id UUID REFERENCES narration_alignments(id),
    audio_storage_key VARCHAR(512),
    audio_size_bytes BIGINT,
    audio_checksum VARCHAR(64),
    audio_duration_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_render_input_snapshot_profile_object CHECK (jsonb_typeof(render_profile_json) = 'object'),
    CONSTRAINT ck_render_input_snapshot_profile_version CHECK ((render_profile_json ->> 'schemaVersion')::integer = 1),
    CONSTRAINT ck_render_input_snapshot_renderer_version CHECK (length(COALESCE(render_profile_json ->> 'rendererVersion', '')) > 0),
    CONSTRAINT ck_render_input_snapshots_audio_complete CHECK (
        (
            narration_request_id IS NULL
            AND narration_asset_id IS NULL
            AND audio_storage_key IS NULL
            AND audio_size_bytes IS NULL
            AND audio_checksum IS NULL
            AND audio_duration_ms IS NULL
        )
        OR
        (
            narration_request_id IS NOT NULL
            AND narration_asset_id IS NOT NULL
            AND audio_storage_key IS NOT NULL
            AND audio_size_bytes > 0
            AND audio_checksum ~ '^[0-9a-f]{64}$'
            AND audio_duration_ms > 0
        )
    )
);

CREATE TABLE render_input_snapshot_beats (
    generation_job_id UUID NOT NULL REFERENCES render_input_snapshots(generation_job_id) ON DELETE CASCADE,
    scene_index INTEGER NOT NULL CHECK (scene_index >= 0),
    beat_index INTEGER NOT NULL CHECK (beat_index >= 0),
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id),
    media_generation_item_id UUID NOT NULL REFERENCES media_generation_items(id),
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    duration_ms BIGINT,
    camera_movement VARCHAR(32) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (generation_job_id, scene_index, beat_index),
    CONSTRAINT ck_render_input_snapshot_beats_duration CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT ck_render_input_snapshot_beats_camera CHECK (
        camera_movement IN ('NONE', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK', 'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX')
    ),
    CONSTRAINT ck_render_input_snapshot_beats_checksum CHECK (checksum ~ '^[0-9a-f]{64}$')
);

CREATE TABLE chapter_media_heads (
    chapter_id UUID PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    generation_job_id UUID NOT NULL UNIQUE REFERENCES generation_jobs(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Project render snapshots and desktop/cloud execution routing
-- -----------------------------------------------------------------------------

CREATE TABLE project_render_input_snapshots (
    generation_job_id UUID PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id),
    story_version_id UUID NOT NULL REFERENCES story_versions(id),
    resolution VARCHAR(16) NOT NULL,
    render_format VARCHAR(16) NOT NULL,
    aspect_ratio VARCHAR(16) NOT NULL,
    total_duration_ms BIGINT NOT NULL CHECK (total_duration_ms > 0),
    chapter_count INTEGER NOT NULL CHECK (chapter_count > 0),
    beat_count INTEGER NOT NULL CHECK (beat_count > 0),
    execution_target VARCHAR(24) NOT NULL DEFAULT 'CLOUD',
    assigned_local_device_id UUID REFERENCES local_devices(id),
    render_profile_json JSONB NOT NULL DEFAULT '{
      "schemaVersion": 1,
      "engine": "ffmpeg-python",
      "rendererVersion": "project-image-motion-v2-frame-quantized",
      "fps": 30,
      "video": {
        "encoder": "libx264",
        "x264Preset": "veryfast",
        "crf": 20,
        "nvencPreset": "p5",
        "nvencCq": 21,
        "pixelFormat": "yuv420p"
      },
      "audio": {
        "codec": "aac",
        "bitrate": "192k",
        "sampleRate": 48000
      },
      "effects": {
        "transition": "LEGACY_FADE",
        "transitionSeconds": 0.12,
        "colorGrade": "NONE",
        "backgroundMode": "COVER",
        "backgroundBlurSigma": 22.0,
        "overlayStyle": "NONE",
        "overlayOpacity": 0.30,
        "watermarkWidthRatio": 0.12,
        "watermarkOpacity": 0.82,
        "watermarkPosition": "TOP_RIGHT",
        "bgmVolume": 0.18,
        "duckThreshold": 0.08,
        "duckRatio": 8.0,
        "duckAttackMs": 20.0,
        "duckReleaseMs": 350.0,
        "motionEasing": "LINEAR",
        "textOverlays": [],
        "lutAsset": null,
        "overlayAsset": null,
        "watermarkAsset": null,
        "bgmAsset": null
      },
      "subtitles": {"mode": "none"}
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_project_render_input_resolution CHECK (resolution IN ('720p', '1080p')),
    CONSTRAINT ck_project_render_input_format CHECK (render_format = 'mp4'),
    CONSTRAINT ck_project_render_profile_object CHECK (jsonb_typeof(render_profile_json) = 'object'),
    CONSTRAINT ck_project_render_profile_version CHECK ((render_profile_json ->> 'schemaVersion')::integer = 1),
    CONSTRAINT ck_project_render_execution_target CHECK (execution_target IN ('CLOUD', 'LOCAL_DEVICE')),
    CONSTRAINT ck_project_render_execution_assignment CHECK (
        (execution_target = 'CLOUD' AND assigned_local_device_id IS NULL)
        OR
        (execution_target = 'LOCAL_DEVICE' AND assigned_local_device_id IS NOT NULL)
    )
);

CREATE TABLE project_render_input_chapters (
    generation_job_id UUID NOT NULL REFERENCES project_render_input_snapshots(generation_job_id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    chapter_order_index INTEGER NOT NULL,
    chapter_row_version BIGINT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    media_plan_revision INTEGER NOT NULL CHECK (media_plan_revision > 0),
    global_start_ms BIGINT NOT NULL CHECK (global_start_ms >= 0),
    global_end_ms BIGINT NOT NULL,
    audio_storage_key TEXT NOT NULL,
    audio_size_bytes BIGINT NOT NULL CHECK (audio_size_bytes > 0),
    audio_checksum VARCHAR(128) NOT NULL,
    audio_duration_ms BIGINT NOT NULL CHECK (audio_duration_ms > 0),
    narration_request_id UUID,
    narration_asset_id UUID,
    narration_alignment_id UUID,
    PRIMARY KEY (generation_job_id, chapter_id),
    CONSTRAINT ck_project_render_chapter_range CHECK (global_end_ms > global_start_ms)
);

-- Render jobs snapshot editor media choices immutably. LOCAL_ONLY media deliberately
-- has no backend storage key; the assigned Desktop resolves it by stable mediaAssetId
-- from its project.manifest.json.
CREATE TABLE project_render_input_beats (
    generation_job_id UUID NOT NULL REFERENCES project_render_input_snapshots(generation_job_id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    scene_index INTEGER NOT NULL,
    beat_index INTEGER NOT NULL,
    visual_beat_id UUID NOT NULL,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    global_start_ms BIGINT NOT NULL CHECK (global_start_ms >= 0),
    global_end_ms BIGINT NOT NULL,
    duration_ms BIGINT NOT NULL CHECK (duration_ms > 0),
    camera_movement VARCHAR(32) NOT NULL DEFAULT 'NONE',
    storage_key TEXT,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum VARCHAR(128) NOT NULL,
    media_type VARCHAR(16) NOT NULL DEFAULT 'IMAGE',
    storage_mode VARCHAR(24) NOT NULL DEFAULT 'REMOTE',
    source_duration_ms BIGINT,
    fit_mode VARCHAR(24) NOT NULL DEFAULT 'TRIM',
    trim_start_ms BIGINT NOT NULL DEFAULT 0,
    media_selection_active BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (generation_job_id, visual_beat_id),
    CONSTRAINT ck_project_render_beat_range CHECK (global_end_ms > global_start_ms),
    CONSTRAINT ck_project_render_input_beat_media_type CHECK (media_type IN ('IMAGE', 'VIDEO')),
    CONSTRAINT ck_project_render_input_beat_storage_mode CHECK (storage_mode IN ('REMOTE', 'LOCAL_ONLY', 'HYBRID')),
    CONSTRAINT ck_project_render_input_beat_source_duration CHECK (source_duration_ms IS NULL OR source_duration_ms > 0),
    CONSTRAINT ck_project_render_input_beat_fit_mode CHECK (fit_mode IN ('TRIM', 'LOOP', 'FREEZE_END', 'SPEED_ADJUST')),
    CONSTRAINT ck_project_render_input_beat_trim_start CHECK (trim_start_ms >= 0)
);

-- -----------------------------------------------------------------------------
-- Database logic and immutable-state triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reject_media_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new media plan revision instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_plans_immutable
BEFORE UPDATE ON media_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE TRIGGER trg_media_scene_plans_immutable
BEFORE UPDATE ON media_scene_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE TRIGGER trg_media_beat_plans_immutable
BEFORE UPDATE ON media_beat_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

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

CREATE OR REPLACE FUNCTION reject_render_input_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new render generation job instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_render_input_snapshots_immutable
BEFORE UPDATE ON render_input_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_render_input_snapshot_update();

CREATE TRIGGER trg_render_input_snapshot_beats_immutable
BEFORE UPDATE ON render_input_snapshot_beats
FOR EACH ROW EXECUTE FUNCTION reject_render_input_snapshot_update();

CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    reconciled_cost NUMERIC(19, 9);
    reconciled_currency VARCHAR(3);
    billed_operation_count INTEGER;
    local_zero_cost_narration BOOLEAN := FALSE;
    local_credit_render BOOLEAN := FALSE;
BEGIN
    SELECT COALESCE(SUM(po.actual_cost), 0),
           CASE
               WHEN COUNT(DISTINCT po.billing_currency)
                    FILTER (WHERE po.actual_cost IS NOT NULL) = 1
                   THEN MAX(po.billing_currency) FILTER (WHERE po.actual_cost IS NOT NULL)
               ELSE NULL
           END,
           COUNT(*) FILTER (WHERE po.actual_cost IS NOT NULL)
      INTO reconciled_cost, reconciled_currency, billed_operation_count
      FROM provider_operations po
      JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
     WHERE sa.generation_job_id = NEW.id;

    IF NEW.job_type = 'NARRATION_GENERATE' THEN
        SELECT EXISTS (
            SELECT 1
              FROM narration_operations no
              JOIN narration_requests nr ON nr.id = no.narration_request_id
              LEFT JOIN voice_catalog vc ON vc.id = nr.voice_id
             WHERE no.generation_job_id = NEW.id
               AND (
                   UPPER(COALESCE(vc.provider, '')) = 'VIENEU'
                   OR COALESCE(vc.metadata_json ->> 'executionSemantics', '') = 'LOCAL_RETRYABLE'
                   OR nr.voice_id LIKE 'vieneu-%'
               )
        ) INTO local_zero_cost_narration;
    END IF;

    local_credit_render :=
        NEW.job_type IN ('CHAPTER_RENDER', 'RENDER_PROJECT')
        AND NEW.resource_class = 'CPU_RENDER';

    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
        IF local_zero_cost_narration AND billed_operation_count = 0 THEN
            UPDATE quota_reservations
               SET status = 'CONSUMED',
                   actual_cost = 0,
                   billing_currency = 'USD',
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED';
        ELSIF local_credit_render AND billed_operation_count = 0 THEN
            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = estimated_cost,
                       billing_currency = 'USD',
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        ELSE
            IF billed_operation_count = 0 OR reconciled_currency IS NULL THEN
                RAISE EXCEPTION 'Cannot complete generation job % without reconciled provider billing', NEW.id;
            END IF;

            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = reconciled_cost,
                       billing_currency = reconciled_currency,
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        END IF;
    ELSIF NEW.status IN ('FAILED', 'CANCELED')
          AND OLD.status IS DISTINCT FROM NEW.status THEN
        IF billed_operation_count > 0
           AND reconciled_currency IS NOT NULL
           AND reconciled_cost > 0 THEN
            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = reconciled_cost,
                       billing_currency = reconciled_currency,
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        ELSE
            UPDATE quota_reservations
               SET status = 'RELEASED',
                   actual_cost = 0,
                   billing_currency = COALESCE(reconciled_currency, 'USD'),
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generation_jobs_finalize_quota
AFTER UPDATE OF status ON generation_jobs
FOR EACH ROW
WHEN (NEW.status IN ('COMPLETED', 'FAILED', 'CANCELED'))
EXECUTE FUNCTION finalize_quota_reservation_on_job_terminal();

CREATE OR REPLACE FUNCTION create_generation_completion_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    notification_type VARCHAR(48);
    notification_title_key VARCHAR(128);
    notification_message_key VARCHAR(128);
BEGIN
    IF NEW.status = 'COMPLETED'
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.job_type IN ('CHAPTER_GENERATE', 'IMAGE_GENERATE', 'SHOT_IMAGE_GENERATE', 'NARRATION_GENERATE') THEN
        IF NEW.job_type = 'NARRATION_GENERATE' THEN
            notification_type := 'NARRATION_COMPLETED';
            notification_title_key := 'notification.narration.completed';
            notification_message_key := 'notification.narration.completed.desc';
        ELSE
            notification_type := 'IMAGE_GENERATION_COMPLETED';
            notification_title_key := 'notification.image_generation.completed';
            notification_message_key := 'notification.image_generation.completed.desc';
        END IF;

        INSERT INTO notifications (
            user_id,
            project_id,
            event_key,
            type,
            title_key,
            message_key
        ) VALUES (
            NEW.requested_by_user_id,
            NEW.project_id,
            'generation-job:' || NEW.job_id::text || ':completed',
            notification_type,
            notification_title_key,
            notification_message_key
        ) ON CONFLICT (event_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generation_jobs_notify_completion
AFTER UPDATE OF status ON generation_jobs
FOR EACH ROW
WHEN (NEW.status = 'COMPLETED')
EXECUTE FUNCTION create_generation_completion_notification();

CREATE OR REPLACE FUNCTION notify_generation_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_type TEXT;
    target_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IS NOT DISTINCT FROM NEW.status
           AND OLD.progress IS NOT DISTINCT FROM NEW.progress
           AND OLD.current_step IS NOT DISTINCT FROM NEW.current_step
           AND OLD.error_code IS NOT DISTINCT FROM NEW.error_code THEN
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.chapter_id IS NOT NULL THEN
        target_type := 'CHAPTER';
        target_id := NEW.chapter_id;
    ELSIF NEW.story_version_id IS NOT NULL THEN
        target_type := 'STORY_VERSION';
        target_id := NEW.story_version_id;
    ELSE
        target_type := 'PROJECT';
        target_id := NEW.project_id;
    END IF;

    PERFORM pg_notify(
        'narrativex_generation_events',
        json_build_object(
            'eventId', NEW.job_id::text || ':' || NEW.row_version::text,
            'userId', NEW.requested_by_user_id,
            'projectId', NEW.project_id,
            'job', json_build_object(
                'jobId', NEW.job_id,
                'type', NEW.job_type,
                'status', NEW.status,
                'progress', NEW.progress,
                'currentStep', NEW.current_step,
                'entityType', target_type,
                'entityId', target_id,
                'target', json_build_object('type', target_type, 'id', target_id),
                'errorCode', NEW.error_code,
                'mediaPlanId', NEW.media_plan_id,
                'mediaPlanRevision', NEW.media_plan_revision
            )
        )::text
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generation_jobs_sse_events
AFTER INSERT OR UPDATE OF status, progress, current_step, error_code ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_generation_job_change();

COMMENT ON COLUMN project_render_input_snapshots.execution_target IS
    'Execution routing for immutable project renders. CLOUD uses the Python worker; LOCAL_DEVICE is claimed by the assigned NarrativeX desktop device.';
COMMENT ON COLUMN project_render_input_snapshots.assigned_local_device_id IS
    'Paired desktop device assigned to LOCAL_DEVICE project rendering. Null for CLOUD renders.';
