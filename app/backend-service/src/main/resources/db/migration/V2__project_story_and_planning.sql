-- NarrativeX pre-release baseline: project, story, storyboard, reusable entities, and media planning.

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
    visual_direction_json TEXT,
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
