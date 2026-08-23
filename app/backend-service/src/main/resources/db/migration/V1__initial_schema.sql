-- NarrativeX consolidated PostgreSQL/Flyway baseline schema.
-- PostgreSQL is authoritative; Redis remains an acceleration layer only.

-- -----------------------------------------------------------------------------
-- Baseline marker
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_baseline (
    id VARCHAR(64) PRIMARY KEY,
    initialized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_baseline (id, description)
VALUES ('v1_baseline', 'NarrativeX consolidated schema baseline')
ON CONFLICT (id) DO NOTHING;

-- PostgreSQL 17 does not provide a built-in UUIDv7 function. Keep generation in
-- the database because several MyBatis inserts omit the id column and RETURNING id.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION narrativex_uuid_v7()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    unix_ts_ms BIGINT;
    random_bytes BYTEA;
    random_hex TEXT;
    raw_hex TEXT;
    variant_hex TEXT;
BEGIN
    unix_ts_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::BIGINT;
    random_bytes := gen_random_bytes(10);
    random_hex := encode(random_bytes, 'hex');
    variant_hex := lpad(to_hex((get_byte(random_bytes, 2) & 63) | 128), 2, '0');

    raw_hex :=
        lpad(to_hex(unix_ts_ms), 12, '0')
        || '7'
        || substr(random_hex, 1, 3)
        || variant_hex
        || substr(random_hex, 7, 14);

    RETURN (
        substr(raw_hex, 1, 8) || '-'
        || substr(raw_hex, 9, 4) || '-'
        || substr(raw_hex, 13, 4) || '-'
        || substr(raw_hex, 17, 4) || '-'
        || substr(raw_hex, 21, 12)
    )::uuid;
END;
$$;

-- -----------------------------------------------------------------------------
-- Authentication & Users
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth_users (
    id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(160) NOT NULL,
    avatar_url TEXT,
    password_hash VARCHAR(255),
    google_subject VARCHAR(255) UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX idx_local_device_pairing_codes_user
    ON local_device_pairing_codes (user_id, created_at DESC);

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

CREATE INDEX idx_local_devices_user
    ON local_devices (user_id, created_at DESC);

CREATE INDEX idx_local_devices_last_seen
    ON local_devices (last_seen_at DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE local_device_capabilities (
    device_id UUID NOT NULL REFERENCES local_devices(id) ON DELETE CASCADE,
    capability VARCHAR(64) NOT NULL,
    PRIMARY KEY (device_id, capability)
);

-- -----------------------------------------------------------------------------
-- Durable domain foundation (Projects, Stories, Chapters, Revisions, Scenes, Visual Beats)
-- -----------------------------------------------------------------------------

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX idx_projects_owner_status ON projects (owner_id, status);
CREATE INDEX idx_projects_owner_updated_id ON projects (owner_id, updated_at DESC, id DESC);
CREATE INDEX idx_projects_active_owner_updated_id
    ON projects (owner_id, updated_at DESC, id DESC)
    WHERE archived_at IS NULL;
CREATE INDEX idx_projects_owner_status_updated_active
    ON projects (owner_id, status, updated_at DESC, id DESC)
    WHERE archived_at IS NULL;
CREATE INDEX idx_projects_owner_created_active
    ON projects (owner_id, created_at ASC, id ASC)
    WHERE archived_at IS NULL;
CREATE INDEX idx_projects_owner_lower_name_active
    ON projects (owner_id, LOWER(name), id)
    WHERE archived_at IS NULL;

CREATE TABLE project_favorites (
    user_id VARCHAR(128) NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_favorites PRIMARY KEY (user_id, project_id)
);
CREATE INDEX idx_project_favorites_project_user
    ON project_favorites (project_id, user_id);

CREATE TABLE story_versions (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    source_language VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    moderation_decision VARCHAR(16) NOT NULL,
    CONSTRAINT uk_story_versions_project_version UNIQUE (project_id, version_number),
    CONSTRAINT ck_story_versions_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'BLOCKED')),
    CONSTRAINT ck_story_versions_moderation_decision
        CHECK (moderation_decision IN ('NOT_REQUIRED', 'PENDING', 'SAFE', 'REVIEW', 'BLOCK'))
);

CREATE UNIQUE INDEX uq_story_versions_one_active_per_project
    ON story_versions (project_id)
    WHERE status = 'ACTIVE';

CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
    CONSTRAINT uk_chapters_story_order UNIQUE (story_version_id, order_index),
    CONSTRAINT ck_chapters_source_hash_sha256 CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE chapter_creation_idempotency (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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

CREATE INDEX idx_chapter_creation_idempotency_chapter
    ON chapter_creation_idempotency (chapter_id)
    WHERE chapter_id IS NOT NULL;

CREATE TABLE chapter_content_variants (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    source_variant_id UUID REFERENCES chapter_content_variants(id),
    variant_type VARCHAR(32) NOT NULL,
    language_code VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    source_content_hash VARCHAR(64),
    translation_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    translation_provider VARCHAR(64),
    translation_model VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_chapter_content_variants_type
        CHECK (variant_type IN ('ORIGINAL', 'TRANSLATION')),
    CONSTRAINT ck_chapter_content_variants_status
        CHECK (translation_status IN (
            'NOT_REQUIRED', 'PENDING_CONFIRMATION', 'QUEUED', 'TRANSLATING',
            'COMPLETED', 'FAILED', 'CANCELLED', 'STALE'
        )),
    CONSTRAINT ck_chapter_content_variants_hash
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_chapter_content_variants_source
        CHECK ((variant_type = 'ORIGINAL' AND source_variant_id IS NULL)
            OR (variant_type = 'TRANSLATION' AND source_variant_id IS NOT NULL AND source_content_hash IS NOT NULL))
);

CREATE UNIQUE INDEX uq_chapter_original_variants_identity
    ON chapter_content_variants (chapter_id, language_code, content_hash)
    WHERE variant_type = 'ORIGINAL';

CREATE UNIQUE INDEX uq_chapter_translation_variants_lineage
    ON chapter_content_variants (
        chapter_id,
        source_variant_id,
        language_code,
        source_content_hash,
        content_hash
    )
    WHERE variant_type = 'TRANSLATION';

CREATE INDEX idx_chapter_content_variants_chapter_created
    ON chapter_content_variants (chapter_id, created_at DESC, id DESC);

CREATE TABLE language_detections (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    content_variant_id UUID NOT NULL REFERENCES chapter_content_variants(id),
    detected_language VARCHAR(32) NOT NULL,
    confidence NUMERIC(5,4) NOT NULL,
    detector VARCHAR(64) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_language_detections_confidence CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT ck_language_detections_hash CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uq_language_detections_variant_hash_detector
        UNIQUE (content_variant_id, content_hash, detector)
);
CREATE INDEX idx_language_detections_variant_created
    ON language_detections (content_variant_id, created_at DESC, id DESC);

CREATE TABLE storyboard_revisions (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    revision_number INTEGER NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    source_row_version BIGINT NOT NULL,
    based_on_revision_id UUID REFERENCES storyboard_revisions(id),
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    content_variant_id UUID REFERENCES chapter_content_variants(id),
    CONSTRAINT uk_storyboard_revisions_chapter_number UNIQUE (chapter_id, revision_number),
    CONSTRAINT ck_storyboard_revisions_status CHECK (status IN ('DRAFT', 'FAILED')),
    CONSTRAINT ck_storyboard_revisions_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_storyboard_revisions_chapter_created
    ON storyboard_revisions (chapter_id, revision_number DESC);

ALTER TABLE chapters
    ADD CONSTRAINT fk_chapters_current_storyboard_revision
    FOREIGN KEY (current_storyboard_revision_id) REFERENCES storyboard_revisions(id);

-- -----------------------------------------------------------------------------
-- Reusable character identity and project assignments
-- -----------------------------------------------------------------------------

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_id VARCHAR(128) NOT NULL,
    workspace_id VARCHAR(128),
    canonical_name VARCHAR(160) NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX idx_characters_owner_status ON characters (owner_id, status);

CREATE TABLE character_versions (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX idx_character_versions_character_status
    ON character_versions (character_id, status);

CREATE TABLE outfit_versions (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX idx_character_appearances_character_timeline
    ON character_appearances (character_id, timeline_key);

CREATE TABLE project_characters (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
    CONSTRAINT ck_project_characters_importance_nonnegative CHECK (importance >= 0)
);
CREATE INDEX idx_project_characters_project_status ON project_characters (project_id, status);
CREATE INDEX idx_project_characters_character ON project_characters (character_id);
CREATE UNIQUE INDEX uq_project_characters_project_id_id ON project_characters (project_id, id);

-- -----------------------------------------------------------------------------
-- Project Locations & Assets
-- -----------------------------------------------------------------------------

CREATE TABLE project_locations (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    visual_prompt TEXT,
    reference_image_url TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT ck_project_locations_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);
CREATE INDEX idx_project_locations_project_updated
    ON project_locations (project_id, updated_at DESC, id DESC);
CREATE INDEX idx_project_locations_active_project
    ON project_locations (project_id, id)
    WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_project_locations_project_id_id ON project_locations (project_id, id);

CREATE TABLE project_assets (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX idx_project_assets_project_updated
    ON project_assets (project_id, updated_at DESC, id DESC);
CREATE INDEX idx_project_assets_active_project
    ON project_assets (project_id, id)
    WHERE status = 'ACTIVE';

-- -----------------------------------------------------------------------------
-- AI Continuity Identities
-- -----------------------------------------------------------------------------

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
CREATE INDEX idx_project_character_ai_identity_entity
    ON project_character_ai_identities (project_id, project_character_id);

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
CREATE INDEX idx_project_location_ai_identity_entity
    ON project_location_ai_identities (project_id, project_location_id);

-- -----------------------------------------------------------------------------
-- Scenes, Scene Continuity & Visual Beats
-- -----------------------------------------------------------------------------

CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX idx_scenes_chapter_status ON scenes (chapter_id, status);
CREATE INDEX idx_scenes_revision_status ON scenes (storyboard_revision_id, status);
CREATE INDEX idx_scenes_project_location
    ON scenes (project_location_id)
    WHERE project_location_id IS NOT NULL;

CREATE TABLE scene_characters (
    scene_id UUID NOT NULL
        REFERENCES scenes(id)
        ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    project_character_id UUID NOT NULL
        REFERENCES project_characters(id),
    CONSTRAINT pk_scene_characters
        PRIMARY KEY (scene_id, project_character_id),
    CONSTRAINT uk_scene_characters_scene_order
        UNIQUE (scene_id, order_index),
    CONSTRAINT ck_scene_characters_order_nonnegative
        CHECK (order_index >= 0)
);
CREATE INDEX idx_scene_characters_project_character
    ON scene_characters (project_character_id);

CREATE TABLE visual_beats (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
    CONSTRAINT ck_visual_beats_camera_movement CHECK (camera_movement IN ('NONE', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK', 'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX')),
    CONSTRAINT ck_visual_beats_text_start_nonnegative CHECK (text_start IS NULL OR text_start >= 0),
    CONSTRAINT ck_visual_beats_text_range CHECK (text_end IS NULL OR (text_start IS NOT NULL AND text_end >= text_start)),
    CONSTRAINT ck_visual_beats_audio_start_nonnegative CHECK (audio_start_ms IS NULL OR audio_start_ms >= 0),
    CONSTRAINT ck_visual_beats_audio_range CHECK (audio_end_ms IS NULL OR (audio_start_ms IS NOT NULL AND audio_end_ms >= audio_start_ms)),
    CONSTRAINT ck_visual_beats_camera_angle CHECK (camera_angle IS NULL OR camera_angle IN (
        'WIDE', 'MEDIUM', 'CLOSE_UP', 'EXTREME_CLOSE_UP', 'LOW_ANGLE',
        'HIGH_ANGLE', 'OVER_THE_SHOULDER', 'POV'
    ))
);
CREATE INDEX idx_visual_beats_scene_review_order
    ON visual_beats (scene_id, review_status, order_index, id);
CREATE INDEX idx_visual_beats_audio_range
    ON visual_beats (scene_id, audio_start_ms, audio_end_ms, order_index)
    WHERE audio_start_ms IS NOT NULL;
CREATE INDEX idx_visual_beats_preview_asset
    ON visual_beats (preview_asset_id)
    WHERE preview_asset_id IS NOT NULL;

CREATE TABLE visual_beat_characters (
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    project_character_id UUID NOT NULL REFERENCES project_characters(id) ON DELETE CASCADE,
    role VARCHAR(24) NOT NULL DEFAULT 'SECONDARY',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_visual_beat_characters PRIMARY KEY (visual_beat_id, project_character_id),
    CONSTRAINT ck_visual_beat_characters_role
        CHECK (role IN ('PRIMARY', 'SECONDARY', 'BACKGROUND'))
);
CREATE INDEX idx_visual_beat_characters_project_character
    ON visual_beat_characters (project_character_id, visual_beat_id);

-- -----------------------------------------------------------------------------
-- Backend-Authoritative Media Plans
-- -----------------------------------------------------------------------------

CREATE TABLE media_plans (
    id UUID PRIMARY KEY,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    chapter_row_version BIGINT NOT NULL CHECK (chapter_row_version >= 0),
    source_hash VARCHAR(64) NOT NULL,
    production_mode VARCHAR(32) NOT NULL
        CHECK (production_mode IN ('IMAGE_MOTION', 'HYBRID_LOCAL_I2V')),
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
    CONSTRAINT ck_media_plans_workflow_version
        CHECK (workflow_version IS NULL OR length(workflow_version) BETWEEN 1 AND 64),
    CONSTRAINT ck_media_plans_image_aspect_ratio
        CHECK (image_aspect_ratio IS NULL OR image_aspect_ratio IN ('16:9', '9:16', '1:1', '4:3', '3:4')),
    CONSTRAINT ck_media_plans_image_quality_tier
        CHECK (image_quality_tier IS NULL OR image_quality_tier IN ('DRAFT', 'STANDARD', 'HIGH')),
    CONSTRAINT ck_media_plans_pricing_snapshot_object
        CHECK (pricing_snapshot_json IS NULL OR jsonb_typeof(pricing_snapshot_json) = 'object'),
    CONSTRAINT ck_media_plans_pricing_fingerprint
        CHECK (pricing_fingerprint IS NULL OR pricing_fingerprint ~ '^[0-9a-f]{64,128}$')
);
CREATE INDEX idx_media_plans_chapter_created
    ON media_plans (chapter_id, created_at DESC);

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
    semantic_motion_mode VARCHAR(32) NOT NULL
        CHECK (semantic_motion_mode IN ('STILL', 'BASIC_MOTION', 'AI_VIDEO')),
    motion_strategy VARCHAR(32) NOT NULL
        CHECK (motion_strategy IN ('BASIC_IMAGE_MOTION', 'IMAGE_TO_VIDEO')),
    asset_strategy VARCHAR(32),
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
    CONSTRAINT ck_media_beat_plans_prompt_snapshot_size
        CHECK (prompt_snapshot IS NULL OR length(prompt_snapshot) <= 16000),
    CONSTRAINT ck_media_beat_plans_audio_range
        CHECK (audio_start_ms IS NULL OR (audio_end_ms IS NOT NULL AND audio_start_ms >= 0 AND audio_end_ms > audio_start_ms)),
    CONSTRAINT ck_media_beat_plans_audio_duration
        CHECK (audio_duration_ms IS NULL OR audio_duration_ms > 0),
    CONSTRAINT ck_media_beat_plans_image_settings_object
        CHECK (image_settings_json IS NULL OR jsonb_typeof(image_settings_json) = 'object'),
    CONSTRAINT ck_media_beat_plans_character_snapshot_object
        CHECK (character_snapshot_json IS NULL OR jsonb_typeof(character_snapshot_json) = 'object'),
    CONSTRAINT ck_media_beat_plans_snapshot_fingerprint
        CHECK (snapshot_fingerprint IS NULL OR snapshot_fingerprint ~ '^[0-9a-f]{64,128}$')
);

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

-- -----------------------------------------------------------------------------
-- Generation Jobs, Stage Attempts & Durable Provider Operations
-- -----------------------------------------------------------------------------

CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    job_id VARCHAR(36) NOT NULL UNIQUE,
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
    idempotency_key VARCHAR(200),
    storyboard_revision_id UUID REFERENCES storyboard_revisions(id),
    media_plan_id UUID,
    media_plan_revision INTEGER,
    production_mode VARCHAR(32),
    content_variant_id UUID REFERENCES chapter_content_variants(id),
    source_variant_id UUID REFERENCES chapter_content_variants(id),
    target_language VARCHAR(32),
    CONSTRAINT ck_generation_jobs_progress CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT ck_generation_jobs_status CHECK (status IN (
        'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
    )),
    CONSTRAINT ck_generation_jobs_job_type CHECK (job_type IN (
        'STORY_ANALYZE', 'CHAPTER_ANALYZE', 'CHAPTER_TRANSLATE', 'NARRATION_GENERATE', 'IMAGE_GENERATE',
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
        production_mode IS NULL
        OR production_mode IN ('IMAGE_MOTION', 'HYBRID_LOCAL_I2V')
    ),
    CONSTRAINT fk_generation_jobs_media_plan
        FOREIGN KEY (media_plan_id, media_plan_revision, production_mode)
        REFERENCES media_plans(id, revision, production_mode)
);
CREATE UNIQUE INDEX uq_generation_jobs_owner_idempotency_key
    ON generation_jobs (requested_by_user_id, idempotency_key)
    WHERE requested_by_user_id IS NOT NULL AND idempotency_key IS NOT NULL;
CREATE INDEX idx_generation_jobs_chapter_created
    ON generation_jobs (chapter_id, created_at DESC)
    WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_generation_jobs_project_status
    ON generation_jobs (project_id, status);
CREATE INDEX idx_generation_jobs_media_plan_id
    ON generation_jobs(media_plan_id)
    WHERE media_plan_id IS NOT NULL;
CREATE INDEX idx_generation_jobs_requester_created_id
    ON generation_jobs (requested_by_user_id, created_at DESC, id DESC);

CREATE TABLE stage_attempts (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX idx_stage_attempts_claimable
    ON stage_attempts (status, created_at, id)
    WHERE status IN ('QUEUED', 'STALLED');
CREATE INDEX idx_stage_attempts_running_heartbeat
    ON stage_attempts (heartbeat_at, created_at, id)
    WHERE status = 'RUNNING';
CREATE INDEX idx_stage_attempts_running_lease
    ON stage_attempts (id, worker_id, lease_token)
    WHERE status = 'RUNNING';

CREATE TABLE provider_operations (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
    CONSTRAINT ck_provider_operations_status CHECK (status IN (
        'RESERVED', 'SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'UNKNOWN'
    )),
    CONSTRAINT ck_provider_operations_actual_cost_nonnegative
        CHECK (actual_cost IS NULL OR actual_cost >= 0),
    CONSTRAINT ck_provider_operations_billing_complete CHECK (
        (actual_cost IS NULL AND billing_currency IS NULL AND usage_json IS NULL AND pricing_snapshot_json IS NULL)
        OR (actual_cost IS NOT NULL AND billing_currency IS NOT NULL AND usage_json IS NOT NULL AND pricing_snapshot_json IS NOT NULL)
    ),
    CONSTRAINT ck_provider_operations_reconcile_attempts CHECK (reconcile_attempts >= 0),
    CONSTRAINT ck_provider_operations_completed_has_result
        CHECK (status <> 'COMPLETED' OR normalized_result_json IS NOT NULL),
    CONSTRAINT ck_provider_operations_completed_has_fingerprint
        CHECK (status <> 'COMPLETED' OR (normalized_result_json IS NOT NULL AND result_fingerprint IS NOT NULL)),
    CONSTRAINT ck_provider_operations_result_fingerprint_format
        CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64,128}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_operation_fingerprint
    ON provider_operations (provider_key, request_fingerprint);
CREATE INDEX idx_provider_operations_completed_replay
    ON provider_operations (stage_attempt_id, id)
    WHERE status = 'COMPLETED' AND normalized_result_json IS NOT NULL;
CREATE INDEX idx_provider_operations_result_fingerprint
    ON provider_operations (result_fingerprint)
    WHERE result_fingerprint IS NOT NULL;
CREATE INDEX idx_provider_operations_reconcile_due
    ON provider_operations (next_reconcile_at, id)
    WHERE status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
      AND next_reconcile_at IS NOT NULL;

CREATE TABLE operation_plans (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
CREATE INDEX IF NOT EXISTS idx_operation_plans_generation_job
    ON operation_plans (generation_job_id);

-- -----------------------------------------------------------------------------
-- Quota Reservations & Billing Trigger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plan_entitlements (
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
    UNIQUE (plan_key, version)
);

CREATE TABLE IF NOT EXISTS user_plan_assignments (
    user_id VARCHAR(128) PRIMARY KEY,
    plan_key VARCHAR(48) NOT NULL,
    entitlement_version INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_windows (
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
    CONSTRAINT ck_quota_reservations_actual_cost_nonnegative
        CHECK (actual_cost IS NULL OR actual_cost >= 0),
    CONSTRAINT ck_quota_reservations_status
        CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
    CONSTRAINT ck_quota_reservations_finalized
        CHECK (
            (status = 'RESERVED' AND finalized_at IS NULL)
            OR (status IN ('CONSUMED', 'RELEASED') AND finalized_at IS NOT NULL)
        )
);
CREATE INDEX idx_quota_reservations_user_status
    ON quota_reservations (user_id, status);
CREATE INDEX idx_quota_reservations_user_period_status
    ON quota_reservations (user_id, period_key, status);
CREATE INDEX idx_quota_reservations_active_user
    ON quota_reservations (user_id, id)
    WHERE status = 'RESERVED';

COMMENT ON COLUMN quota_reservations.estimated_cost IS
    'Admission authorization amount; RESERVED capacity uses this value.';
COMMENT ON COLUMN quota_reservations.actual_cost IS
    'Terminal provider cost reconciled from durable provider usage; never used for admission.';

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

    local_credit_render := NEW.job_type = 'CHAPTER_RENDER' AND NEW.resource_class = 'CPU_RENDER';

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
                RAISE EXCEPTION
                    'Cannot complete generation job % without reconciled provider billing', NEW.id;
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

-- -----------------------------------------------------------------------------
-- Media Assets
-- -----------------------------------------------------------------------------

CREATE TABLE media_assets (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    asset_type VARCHAR(16) NOT NULL,
    origin VARCHAR(24) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
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
    CONSTRAINT ck_media_assets_origin CHECK (origin IN ('USER_UPLOAD', 'TTS_GENERATED', 'IMAGE_GENERATED', 'VIDEO_GENERATED')),
    CONSTRAINT ck_media_assets_status CHECK (status IN ('PENDING_UPLOAD', 'UPLOADING', 'VALIDATING', 'READY', 'REJECTED', 'DELETED')),
    CONSTRAINT ck_media_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_media_assets_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_assets_duration CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT uk_media_assets_account_storage_key UNIQUE (account_id, storage_key)
);
CREATE INDEX idx_media_assets_account_status ON media_assets (account_id, status, created_at DESC);
CREATE INDEX idx_media_assets_account_created_visible
    ON media_assets (account_id, created_at DESC, id DESC)
    WHERE status <> 'DELETED' AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- Character version reference media
-- -----------------------------------------------------------------------------

CREATE TABLE character_version_reference_assets (
    character_version_id UUID NOT NULL REFERENCES character_versions(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    reference_role VARCHAR(24) NOT NULL,
    priority SMALLINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_character_version_reference_assets PRIMARY KEY (character_version_id, media_asset_id),
    CONSTRAINT uq_character_version_reference_priority UNIQUE (character_version_id, priority),
    CONSTRAINT ck_character_version_reference_role CHECK (
        reference_role IN ('IDENTITY', 'PROFILE', 'EXPRESSION', 'OUTFIT', 'POSE')
    ),
    CONSTRAINT ck_character_version_reference_priority CHECK (priority BETWEEN 0 AND 99)
);

CREATE INDEX idx_character_version_reference_asset
    ON character_version_reference_assets (media_asset_id);

COMMENT ON TABLE character_version_reference_assets IS
    'FK-backed immutable character-version references. priority 0 is the preferred identity reference.';

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

CREATE INDEX idx_media_asset_checksums_asset
    ON media_asset_checksums (media_asset_id);

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
        (status = 'RUNNING'
            AND worker_id IS NOT NULL
            AND lease_token IS NOT NULL
            AND lease_until IS NOT NULL)
        OR
        (status <> 'RUNNING'
            AND worker_id IS NULL
            AND lease_token IS NULL
            AND lease_until IS NULL)
    )
);
CREATE INDEX idx_media_validation_jobs_claimable
    ON media_validation_jobs (status, next_attempt_at, created_at, id);
CREATE INDEX idx_media_validation_jobs_expired_leases
    ON media_validation_jobs (lease_until, id)
    WHERE status = 'RUNNING';

COMMENT ON TABLE media_validation_jobs IS
    'Durable media validation queue; PostgreSQL is authoritative and Redis notifications are hints only.';

-- -----------------------------------------------------------------------------
-- Narration Requests, Assets & Alignment (Chapter-level TTS)
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
CREATE INDEX idx_narration_requests_chapter_created
    ON narration_requests (chapter_id, created_at DESC);
CREATE INDEX idx_narration_requests_voice_reference_asset
    ON narration_requests (voice_reference_asset_id)
    WHERE voice_reference_asset_id IS NOT NULL;

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
    CONSTRAINT uk_narration_alignments_asset_version
        UNIQUE (narration_asset_id, alignment_version),
    CONSTRAINT ck_narration_alignments_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_alignments_spans_array CHECK (jsonb_typeof(spans_json) = 'array')
);

COMMENT ON COLUMN narration_requests.source_text IS
    'Immutable chapter text snapshot bound to chapter_row_version/source_hash at narration admission.';
COMMENT ON TABLE narration_operations IS
    'Domain grouping only. Provider lifecycle remains authoritative in provider_operations.';
COMMENT ON COLUMN narration_assets.project_asset_id IS
    'Durable MediaAsset/storage indirection. Provider URLs are never authoritative narration assets.';
COMMENT ON COLUMN narration_alignments.spans_json IS
    'Ordered segment-level spans with UTF-16 text offsets and millisecond audio offsets.';

-- -----------------------------------------------------------------------------
-- Multi-Part / Uploaded Narration
-- -----------------------------------------------------------------------------

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
CREATE INDEX idx_narration_sets_story_created ON narration_sets (story_id, created_at DESC);

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
    CONSTRAINT uk_narration_alignment_runs_cache UNIQUE (
        document_fingerprint, narration_fingerprint, provider, provider_version
    )
);

COMMENT ON TABLE media_assets IS 'Canonical uploaded/generated media metadata; binary bytes remain in private R2.';
COMMENT ON TABLE narration_parts IS 'Ordered logical audio parts. File boundaries are not semantic chapter boundaries.';
COMMENT ON TABLE narration_alignment_runs IS 'Immutable alignment cache keyed by document and ordered narration fingerprints.';

-- -----------------------------------------------------------------------------
-- Control plane, moderation, preferences, audit & policies
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS moderation_decisions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128),
    project_id UUID REFERENCES projects(id),
    entity_type VARCHAR(48) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    direction VARCHAR(16) NOT NULL,
    result VARCHAR(16) NOT NULL,
    categories_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_signal_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_version VARCHAR(64) NOT NULL,
    reviewer_id VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_moderation_entity ON moderation_decisions (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id VARCHAR(128) PRIMARY KEY,
    render_complete_email BOOLEAN NOT NULL DEFAULT FALSE,
    render_failed_email BOOLEAN NOT NULL DEFAULT FALSE,
    short_complete_email BOOLEAN NOT NULL DEFAULT FALSE,
    web_push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    row_version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
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
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read_at, created_at DESC);
CREATE INDEX idx_notifications_user_created_id
    ON notifications (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
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
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (status, available_at);

CREATE TABLE IF NOT EXISTS identity_consents (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    character_id UUID,
    reference_asset_id UUID,
    reference_type VARCHAR(32) NOT NULL,
    consent_basis VARCHAR(128) NOT NULL,
    policy_version VARCHAR(64) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_identity_consents_user ON identity_consents (user_id, revoked_at);

CREATE TABLE IF NOT EXISTS identity_profiles (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id),
    character_id UUID,
    private_template_ref VARCHAR(256) NOT NULL,
    algorithm_version VARCHAR(64) NOT NULL,
    retention_class VARCHAR(48) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ai_audit_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128),
    project_id UUID REFERENCES projects(id),
    job_id UUID REFERENCES generation_jobs(id),
    capability VARCHAR(64) NOT NULL,
    provider VARCHAR(64),
    model_key VARCHAR(128),
    prompt_version VARCHAR(64),
    schema_version VARCHAR(64),
    safety_policy_version VARCHAR(64),
    input_fingerprint VARCHAR(128) NOT NULL,
    usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    generation_params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_project_created ON ai_audit_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    scope VARCHAR(24) NOT NULL,
    scope_id VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(80),
    retention_deadline TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_status ON data_deletion_requests (user_id, status);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(128) PRIMARY KEY,
    preferred_locale VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    default_narration_language VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    default_metadata_language VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    row_version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS abuse_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(128),
    ip_hash VARCHAR(128),
    session_id VARCHAR(128),
    route_key VARCHAR(128) NOT NULL,
    signal_type VARCHAR(64) NOT NULL,
    action VARCHAR(16) NOT NULL,
    policy_version VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_abuse_user_created ON abuse_events (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Immutable render manifests and durable final artifacts
-- -----------------------------------------------------------------------------

CREATE TABLE render_manifests (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
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
    CONSTRAINT ck_render_manifests_source_hash
        CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_render_manifests_fingerprint
        CHECK (render_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_render_manifests_media_plan_revision
        CHECK (media_plan_revision IS NULL OR media_plan_revision > 0)
);
CREATE INDEX idx_render_manifests_chapter_created
    ON render_manifests (chapter_id, created_at DESC, id DESC);
CREATE INDEX idx_render_manifests_project_created
    ON render_manifests (project_id, created_at DESC, id DESC);

ALTER TABLE media_plans
    ADD CONSTRAINT fk_media_plans_narration_set
        FOREIGN KEY (narration_set_id) REFERENCES narration_sets(id),
    ADD CONSTRAINT fk_media_plans_narration_alignment_run
        FOREIGN KEY (narration_alignment_run_id) REFERENCES narration_alignment_runs(id);

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
    CONSTRAINT ck_final_artifacts_type
        CHECK (artifact_type IN ('CHAPTER_VIDEO', 'PROJECT_VIDEO', 'SHORT_VIDEO')),
    CONSTRAINT ck_final_artifacts_status
        CHECK (status IN ('PENDING', 'READY', 'FAILED', 'ARCHIVED')),
    CONSTRAINT ck_final_artifacts_fingerprint
        CHECK (render_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_final_artifacts_checksum
        CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_final_artifacts_size_nonnegative
        CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT ck_final_artifacts_duration_nonnegative
        CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT ck_final_artifacts_dimensions_positive
        CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0)),
    CONSTRAINT ck_final_artifacts_fps_positive
        CHECK (fps IS NULL OR fps > 0)
);
CREATE UNIQUE INDEX uq_final_artifacts_chapter_render_fingerprint
    ON final_artifacts (chapter_id, render_fingerprint)
    WHERE chapter_id IS NOT NULL AND status <> 'ARCHIVED';
CREATE INDEX idx_final_artifacts_project_created
    ON final_artifacts (project_id, created_at DESC, id DESC);
CREATE INDEX idx_final_artifacts_chapter_created
    ON final_artifacts (chapter_id, created_at DESC, id DESC)
    WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_final_artifacts_external_file_id
    ON final_artifacts (storage_provider, external_file_id)
    WHERE external_file_id IS NOT NULL;

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
        OR (status <> 'COMPLETED' AND output_final_artifact_id IS NULL)
    )
);

CREATE INDEX idx_short_clip_requests_claimable
    ON short_clip_requests (status, created_at, id)
    WHERE status IN ('QUEUED', 'RUNNING');
CREATE INDEX idx_short_clip_requests_source
    ON short_clip_requests (source_final_artifact_id, created_at DESC);

COMMENT ON TABLE short_clip_requests IS
    'Durable short-video queue. source_final_artifact_id must reference a READY CHAPTER_VIDEO or PROJECT_VIDEO; worker trims the final video timeline and preserves its source width, height and aspect ratio.';

-- -----------------------------------------------------------------------------
-- Catalog read models
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
CREATE INDEX idx_style_presets_active_category_name
    ON style_presets (category, LOWER(name), id)
    WHERE status = 'ACTIVE';

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
CREATE INDEX idx_voice_catalog_enabled_language_name
    ON voice_catalog (language, LOWER(name), id)
    WHERE enabled = TRUE;

-- -----------------------------------------------------------------------------
-- Media upload sessions
-- -----------------------------------------------------------------------------

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
CREATE INDEX idx_media_upload_sessions_account_status
    ON media_upload_sessions (account_id, status, created_at DESC);
CREATE INDEX idx_media_upload_sessions_expired_pending
    ON media_upload_sessions (expires_at, id)
    WHERE status = 'PENDING_UPLOAD';

-- -----------------------------------------------------------------------------
-- Media storage cleanup tasks
-- -----------------------------------------------------------------------------

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

CREATE UNIQUE INDEX uq_media_storage_cleanup_active_key
    ON media_storage_cleanup_tasks (storage_key)
    WHERE status IN ('PENDING', 'RUNNING');

CREATE INDEX idx_media_storage_cleanup_due
    ON media_storage_cleanup_tasks (status, next_attempt_at, id)
    WHERE status IN ('PENDING', 'RUNNING');

-- -----------------------------------------------------------------------------
-- Media generation execution, review and lineage
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
CREATE INDEX idx_media_asset_lineage_asset ON media_asset_lineage (media_asset_id, created_at DESC);
CREATE INDEX idx_media_asset_lineage_project_chapter ON media_asset_lineage (project_id, chapter_id, created_at DESC);
CREATE INDEX idx_media_asset_lineage_beat ON media_asset_lineage (visual_beat_id, created_at DESC);

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

-- -----------------------------------------------------------------------------
-- Render admission snapshots and authoritative chapter media heads
-- -----------------------------------------------------------------------------

CREATE TABLE render_input_snapshots (
    generation_job_id UUID PRIMARY KEY
        REFERENCES generation_jobs(id) ON DELETE CASCADE,
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
      "subtitles": {
        "mode": "burned-ass"
      }
    }'::jsonb,
    narration_request_id UUID REFERENCES narration_requests(id),
    narration_asset_id UUID REFERENCES narration_assets(id),
    narration_alignment_id UUID REFERENCES narration_alignments(id),
    audio_storage_key VARCHAR(512),
    audio_size_bytes BIGINT,
    audio_checksum VARCHAR(64),
    audio_duration_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_render_input_snapshot_profile_object
        CHECK (jsonb_typeof(render_profile_json) = 'object'),
    CONSTRAINT ck_render_input_snapshot_profile_version
        CHECK ((render_profile_json ->> 'schemaVersion')::integer = 1),
    CONSTRAINT ck_render_input_snapshot_renderer_version
        CHECK (length(COALESCE(render_profile_json ->> 'rendererVersion', '')) > 0),
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
CREATE INDEX idx_render_input_snapshots_media_plan
    ON render_input_snapshots (media_plan_id, media_plan_revision);

CREATE TABLE render_input_snapshot_beats (
    generation_job_id UUID NOT NULL
        REFERENCES render_input_snapshots(generation_job_id) ON DELETE CASCADE,
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
    CONSTRAINT ck_render_input_snapshot_beats_duration
        CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT ck_render_input_snapshot_beats_camera CHECK (
        camera_movement IN (
            'NONE', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK',
            'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX'
        )
    ),
    CONSTRAINT ck_render_input_snapshot_beats_checksum
        CHECK (checksum ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_render_input_snapshot_beats_visual_beat
    ON render_input_snapshot_beats (visual_beat_id);
CREATE INDEX idx_render_input_snapshot_beats_media_asset
    ON render_input_snapshot_beats (media_asset_id);

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

COMMENT ON TABLE render_input_snapshots IS
    'Immutable chapter-render admission snapshot pinned to one generation job and media-plan revision.';
COMMENT ON COLUMN render_input_snapshots.render_profile_json IS
    'Immutable renderer semantics pinned when the render job is admitted. Bump rendererVersion whenever output semantics change.';
COMMENT ON TABLE render_input_snapshot_beats IS
    'Immutable READY image inputs selected for each planned render beat at admission time.';

CREATE TABLE chapter_media_heads (
    chapter_id UUID PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    generation_job_id UUID NOT NULL UNIQUE REFERENCES generation_jobs(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chapter_media_heads_updated
    ON chapter_media_heads (updated_at DESC, chapter_id);

INSERT INTO chapter_media_heads (chapter_id, generation_job_id, updated_at)
SELECT c.id, latest_job.id, COALESCE(latest_job.updated_at, latest_job.created_at)
  FROM chapters c
  JOIN LATERAL (
      SELECT gj.id, gj.created_at, gj.updated_at
        FROM generation_jobs gj
       WHERE gj.chapter_id = c.id
         AND gj.job_type IN ('IMAGE_GENERATE', 'SHOT_IMAGE_GENERATE')
         AND gj.chapter_row_version = c.row_version
         AND gj.source_hash = c.source_hash
         AND gj.storyboard_revision_id = c.current_storyboard_revision_id
         AND gj.media_plan_id IS NOT NULL
         AND gj.media_plan_revision IS NOT NULL
       ORDER BY gj.created_at DESC, gj.id DESC
       LIMIT 1
  ) latest_job ON TRUE
ON CONFLICT (chapter_id) DO UPDATE
SET generation_job_id = EXCLUDED.generation_job_id,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- Seed System Catalogs & Entitlements
-- -----------------------------------------------------------------------------

INSERT INTO plan_entitlements (id, plan_key, version, watermark_required, max_video_quality, max_longform_exports_month, max_short_exports_month, max_concurrent_expensive_jobs, feature_flags_json, monthly_credits, active_from)
VALUES
    (1, 'NORMAL', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, 2.000000, CURRENT_TIMESTAMP),
    (2, 'STANDARD', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, 2.000000, CURRENT_TIMESTAMP),
    (3, 'PRO', 1, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true,"narration":true}'::jsonb, 10.000000, CURRENT_TIMESTAMP),
    (4, 'STANDARD', 2, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true}'::jsonb, 10.000000, CURRENT_TIMESTAMP),
    (5, 'STANDARD', 3, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, 50.000000, CURRENT_TIMESTAMP),
    (6, 'PRO', 2, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, 50.000000, CURRENT_TIMESTAMP),
    (7, 'PRO', 3, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, 100.000000, CURRENT_TIMESTAMP),
    (8, 'PRO', 4, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, 100.000000, CURRENT_TIMESTAMP),
    (9, 'PRO', 5, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP),
    (10, 'PRO', 6, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP),
    (11, 'ULTRA', 1, FALSE, 'ULTRA', NULL, NULL, 20, '{"storyAnalysis":true,"shorts":true,"narration":true,"batchReview":true,"team":true,"priority":true,"payAsYouGo":true}'::jsonb, NULL, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

SELECT setval('plan_entitlements_id_seq', COALESCE((SELECT MAX(id) FROM plan_entitlements), 1), true);

INSERT INTO style_presets
    (id, name, category, description, thumbnail_url, prompt_suffix, negative_prompt, tags_json, config_json)
VALUES
    (1, 'Cinematic Warmth', 'VISUAL_STYLE', 'Warm cinematic lighting with grounded texture.',
     'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
     'cinematic composition, warm practical light, subtle film grain',
     'blurry, distorted anatomy, text, watermark',
     '["cinematic", "warm", "story"]'::jsonb,
     '{"defaultAspectRatio":"16:9","defaultQuality":"Standard","lighting":"warm practical","atmosphere":"intimate"}'::jsonb),
    (2, 'Storybook Watercolor', 'IMAGE', 'Soft illustrated treatment for intimate story moments.',
     'https://images.unsplash.com/photo-1549490349-8643362247b5',
     'storybook watercolor illustration, soft edges, expressive silhouettes',
     'photorealistic, harsh contrast, text, watermark',
     '["illustration", "watercolor", "soft"]'::jsonb,
     '{"defaultAspectRatio":"16:9","defaultQuality":"Standard","lighting":"diffused","atmosphere":"dreamy"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT setval('style_presets_id_seq', COALESCE((SELECT MAX(id) FROM style_presets), 1), true);

INSERT INTO voice_catalog (id, provider, name, language, gender, sample_url, metadata_json)
VALUES
    ('vieneu-ngoc-huyen-v2', 'VIENEU', 'Ngọc Huyền v2', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav', '{"style":"natural","local":true,"sdkVoiceName":"Ngọc Huyền v2","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-minh-duc', 'VIENEU', 'Minh Đức', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-minh-duc.wav', '{"style":"natural","local":true,"sdkVoiceName":"Minh Đức","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-truc-ly', 'VIENEU', 'Trúc Ly', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-truc-ly.wav', '{"style":"gentle","local":true,"sdkVoiceName":"Trúc Ly","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-mai-anh', 'VIENEU', 'Mai Anh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-mai-anh.wav', '{"style":"expressive","local":true,"sdkVoiceName":"Mai Anh","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-quynh-anh', 'VIENEU', 'Quỳnh Anh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-quynh-anh.wav', '{"style":"clear","local":true,"sdkVoiceName":"Quỳnh Anh","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-doan-trang', 'VIENEU', 'Đoan Trang', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-doan-trang.wav', '{"style":"warm","local":true,"sdkVoiceName":"Đoan Trang","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-pham-tuyen', 'VIENEU', 'Phạm Tuyên', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-pham-tuyen.wav', '{"style":"formal","local":true,"sdkVoiceName":"Phạm Tuyên","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-quang-son', 'VIENEU', 'Quang Sơn', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-quang-son.wav', '{"style":"narrative","local":true,"sdkVoiceName":"Quang Sơn","region":"Trung","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-ngoc-tran', 'VIENEU', 'Ngọc Trân', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-tran.wav', '{"style":"melodic","local":true,"sdkVoiceName":"Ngọc Trân","region":"Trung","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-adam', 'VIENEU', 'Adam', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-adam.wav', '{"style":"standard","local":true,"sdkVoiceName":"Adam","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-xuan-vinh', 'VIENEU', 'Xuân Vĩnh', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-xuan-vinh.wav', '{"style":"deep","local":true,"sdkVoiceName":"Xuân Vĩnh","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thai-son', 'VIENEU', 'Thái Sơn', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thai-son.wav', '{"style":"energetic","local":true,"sdkVoiceName":"Thái Sơn","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thuy-dung', 'VIENEU', 'Thùy Dung', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thuy-dung.wav', '{"style":"soft","local":true,"sdkVoiceName":"Thùy Dung","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-my-duyen', 'VIENEU', 'Mỹ Duyên', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-my-duyen.wav', '{"style":"bright","local":true,"sdkVoiceName":"Mỹ Duyên","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-minh-triet', 'VIENEU', 'Minh Triết', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-minh-triet.wav', '{"style":"confident","local":true,"sdkVoiceName":"Minh Triết","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-duc-tri', 'VIENEU', 'Đức Trí', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-duc-tri.wav', '{"style":"mature","local":true,"sdkVoiceName":"Đức Trí","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thuc-doan', 'VIENEU', 'Thục Đoan', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thuc-doan.wav', '{"style":"friendly","local":true,"sdkVoiceName":"Thục Đoan","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-ngoc-huyen', 'VIENEU', 'Ngọc Huyền', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-huyen.wav', '{"style":"natural","local":true,"voiceSource":"PRESET","sdkVoiceName":"Ngọc Huyền","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thanh-binh', 'VIENEU', 'Thanh Bình', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thanh-binh.wav', '{"style":"storytelling","local":true,"voiceSource":"PRESET","sdkVoiceName":"Thanh Bình","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-ngoc-linh', 'VIENEU', 'Ngọc Linh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-linh.wav', '{"style":"storytelling","local":true,"voiceSource":"PRESET","sdkVoiceName":"Ngọc Linh","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-kim-thanh', 'VIENEU', 'Kim Thanh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-kim-thanh.wav', '{"style":"audiobook","local":true,"voiceSource":"PRESET","sdkVoiceName":"Kim Thanh","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider,
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    gender = EXCLUDED.gender,
    sample_url = EXCLUDED.sample_url,
    metadata_json = EXCLUDED.metadata_json,
    enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- Provision default entitlement for existing accounts
INSERT INTO user_plan_assignments
    (user_id, plan_key, entitlement_version, status, period_start, period_end)
SELECT au.id,
       pe.plan_key,
       pe.version,
       'ACTIVE',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP + INTERVAL '1 month'
  FROM auth_users au
  JOIN plan_entitlements pe
    ON pe.plan_key = 'NORMAL'
   AND pe.version = 1
ON CONFLICT (user_id) DO NOTHING;
