-- NarrativeX pre-release baseline: project, story, storyboard, reusable entities, and media planning.
-- Requires PostgreSQL 18+ for native uuidv7() used by domain migrations.

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
    status VARCHAR(32) NOT NULL,
    source_language VARCHAR(16) NOT NULL,
    narration_language VARCHAR(16) NOT NULL,
    metadata_language VARCHAR(16) NOT NULL,
    image_aspect_ratio VARCHAR(16) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_projects_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE TABLE project_favorites (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    CONSTRAINT uq_story_versions_project_id_id UNIQUE (project_id, id),
    CONSTRAINT ck_story_versions_status CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED'))
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
    CONSTRAINT uq_chapters_story_version_id_id UNIQUE (story_version_id, id),
    CONSTRAINT ck_chapters_source_hash_sha256 CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE chapter_creation_idempotency (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL REFERENCES projects(id),
    idempotency_key VARCHAR(200) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    chapter_id UUID REFERENCES chapters(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_chapter_creation_idempotency UNIQUE (project_id, idempotency_key),
    CONSTRAINT ck_chapter_creation_idempotency_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
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
    CONSTRAINT uq_storyboard_revisions_chapter_id_id UNIQUE (chapter_id, id),
    CONSTRAINT ck_storyboard_revisions_status CHECK (status IN ('DRAFT', 'FAILED')),
    CONSTRAINT ck_storyboard_revisions_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

ALTER TABLE chapters
    ADD CONSTRAINT fk_chapters_current_storyboard_revision
    FOREIGN KEY (current_storyboard_revision_id) REFERENCES storyboard_revisions(id);

-- -----------------------------------------------------------------------------
-- Reusable characters, appearances and project participation
-- -----------------------------------------------------------------------------

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uk_outfit_versions_character_version UNIQUE (character_id, version_number)
);

CREATE TABLE character_appearances (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    character_id UUID NOT NULL REFERENCES characters(id),
    project_id UUID REFERENCES projects(id),
    timeline_key VARCHAR(128) NOT NULL,
    age_state VARCHAR(64) NOT NULL,
    hairstyle VARCHAR(128) NOT NULL,
    injury VARCHAR(128),
    wardrobe_context VARCHAR(128),
    appearance_prompt TEXT NOT NULL,
    outfit_version_id UUID REFERENCES outfit_versions(id),
    CONSTRAINT uk_character_appearances_scope UNIQUE (character_id, project_id, timeline_key)
);

CREATE TABLE project_characters (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    character_id UUID NOT NULL REFERENCES characters(id),
    role VARCHAR(32) NOT NULL,
    importance VARCHAR(32) NOT NULL,
    project_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    story_metadata TEXT,
    groups_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    pinned_character_version_id UUID REFERENCES character_versions(id),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uk_project_characters_project_character UNIQUE (project_id, character_id),
    CONSTRAINT uq_project_characters_project_id_id UNIQUE (project_id, id),
    CONSTRAINT ck_project_characters_role CHECK (role IN ('PROTAGONIST', 'ANTAGONIST', 'SUPPORTING', 'EXTRA')),
    CONSTRAINT ck_project_characters_importance CHECK (importance IN ('PRIMARY', 'SECONDARY', 'BACKGROUND'))
);

-- -----------------------------------------------------------------------------
-- Reusable project locations and project assets
-- -----------------------------------------------------------------------------

CREATE TABLE project_locations (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(160) NOT NULL,
    description TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uq_project_locations_project_id_id UNIQUE (project_id, id),
    CONSTRAINT ck_project_locations_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE TABLE project_assets (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(160) NOT NULL,
    asset_type VARCHAR(32) NOT NULL,
    description TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uq_project_assets_project_id_id UNIQUE (project_id, id),
    CONSTRAINT ck_project_assets_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

-- -----------------------------------------------------------------------------
-- AI identity bindings
-- -----------------------------------------------------------------------------

CREATE TABLE project_character_ai_identities (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    project_character_id UUID NOT NULL,
    ai_name VARCHAR(160) NOT NULL,
    aliases_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_character_ai_identity UNIQUE (project_id, project_character_id),
    CONSTRAINT ck_character_ai_identity_aliases_array CHECK (jsonb_typeof(aliases_json) = 'array'),
    CONSTRAINT fk_character_ai_identities_project_character
        FOREIGN KEY (project_id, project_character_id)
        REFERENCES project_characters(project_id, id) ON DELETE CASCADE
);

CREATE TABLE project_location_ai_identities (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    project_location_id UUID NOT NULL,
    ai_name VARCHAR(160) NOT NULL,
    aliases_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_location_ai_identity UNIQUE (project_id, project_location_id),
    CONSTRAINT ck_location_ai_identity_aliases_array CHECK (jsonb_typeof(aliases_json) = 'array'),
    CONSTRAINT fk_location_ai_identities_project_location
        FOREIGN KEY (project_id, project_location_id)
        REFERENCES project_locations(project_id, id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Storyboard details: scenes, visual beats and character links
-- -----------------------------------------------------------------------------

CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    storyboard_revision_id UUID NOT NULL REFERENCES storyboard_revisions(id),
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    project_location_id UUID,
    order_index INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    mood VARCHAR(64),
    lighting VARCHAR(64),
    time_of_day VARCHAR(32),
    location_text VARCHAR(200),
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    CONSTRAINT uk_scenes_revision_order UNIQUE (storyboard_revision_id, order_index),
    CONSTRAINT uq_scenes_chapter_id_id UNIQUE (chapter_id, id),
    CONSTRAINT uq_scenes_scene_id_id UNIQUE (id),
    CONSTRAINT fk_scenes_project_location
        FOREIGN KEY (project_id, project_location_id)
        REFERENCES project_locations(project_id, id) ON DELETE SET NULL
);

CREATE TABLE scene_characters (
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    project_character_id UUID NOT NULL REFERENCES project_characters(id),
    PRIMARY KEY (scene_id, project_character_id)
);

CREATE TABLE visual_beats (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    beat_type VARCHAR(32) NOT NULL,
    visual_summary TEXT NOT NULL,
    visual_description TEXT NOT NULL,
    visual_direction_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status VARCHAR(24) NOT NULL DEFAULT 'NOT_READY',
    audio_duration_ms BIGINT,
    source_anchor_json JSONB NOT NULL,
    CONSTRAINT uk_visual_beats_scene_order UNIQUE (scene_id, order_index),
    CONSTRAINT uq_visual_beats_scene_id_id UNIQUE (scene_id, id),
    CONSTRAINT ck_visual_beats_review_status CHECK (review_status IN ('NOT_READY', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED')),
    CONSTRAINT ck_visual_beats_visual_direction_json_object CHECK (jsonb_typeof(visual_direction_json) = 'object'),
    CONSTRAINT ck_visual_beats_audio_duration CHECK (audio_duration_ms IS NULL OR audio_duration_ms > 0),
    CONSTRAINT ck_visual_beats_source_anchor_object CHECK (jsonb_typeof(source_anchor_json) = 'object'),
    CONSTRAINT ck_visual_beats_source_anchor_ranges CHECK (
        jsonb_typeof(source_anchor_json -> 'textStart') = 'number'
        AND jsonb_typeof(source_anchor_json -> 'textEnd') = 'number'
        AND (source_anchor_json ->> 'textStart')::integer >= 0
        AND (source_anchor_json ->> 'textEnd')::integer > (source_anchor_json ->> 'textStart')::integer
        AND (source_anchor_json ->> 'sourceHash') ~ '^[0-9a-f]{64}$'
    )
);

CREATE TABLE visual_beat_characters (
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    project_character_id UUID NOT NULL REFERENCES project_characters(id),
    PRIMARY KEY (visual_beat_id, project_character_id)
);

-- -----------------------------------------------------------------------------
-- Production planning and visual beat media planning
-- -----------------------------------------------------------------------------

CREATE TABLE media_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    storyboard_revision_id UUID NOT NULL REFERENCES storyboard_revisions(id),
    revision INTEGER NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    production_mode VARCHAR(32) NOT NULL,
    narration_set_id UUID,
    narration_alignment_run_id UUID,
    CONSTRAINT uk_media_plans_chapter_revision UNIQUE (chapter_id, revision),
    CONSTRAINT uq_media_plans_id_revision_production_mode UNIQUE (id, revision, production_mode),
    CONSTRAINT ck_media_plans_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_plans_production_mode CHECK (production_mode = 'IMAGE_MOTION')
);

CREATE TABLE media_beat_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id) ON DELETE CASCADE,
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    reuse_source_visual_beat_id UUID REFERENCES visual_beats(id) ON DELETE SET NULL,
    reuse_type VARCHAR(32) NOT NULL DEFAULT 'NEW',
    generation_mode VARCHAR(16) NOT NULL DEFAULT 'IMAGE',
    camera_movement VARCHAR(32) NOT NULL DEFAULT 'NONE',
    assigned_prompt TEXT,
    CONSTRAINT uk_media_beat_plans_plan_beat UNIQUE (media_plan_id, visual_beat_id),
    CONSTRAINT ck_media_beat_plans_reuse_type CHECK (reuse_type IN ('NEW', 'REUSE_EXACT', 'REUSE_DELTA')),
    CONSTRAINT ck_media_beat_plans_generation_mode CHECK (generation_mode IN ('IMAGE', 'VIDEO'))
);
