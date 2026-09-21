-- NarrativeX: Video-First, Retention-Driven Production Schema (ADR-0026 to ADR-0031)

-- 1. Extend VisualBeats with dramatic intent and retention role
ALTER TABLE visual_beats
    ADD COLUMN IF NOT EXISTS dramatic_intent VARCHAR(32) NOT NULL DEFAULT 'SETUP',
    ADD COLUMN IF NOT EXISTS emotion VARCHAR(64),
    ADD COLUMN IF NOT EXISTS retention_role VARCHAR(32);

-- 2. Hook Plans (pre-generation retention planning for episode opening)
CREATE TABLE hook_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    promise TEXT NOT NULL DEFAULT '',
    conflict TEXT NOT NULL DEFAULT '',
    curiosity_question TEXT NOT NULL DEFAULT '',
    visual_hook TEXT NOT NULL DEFAULT '',
    dialogue_hook TEXT NOT NULL DEFAULT '',
    withheld_information TEXT NOT NULL DEFAULT '',
    payoff_beat_id UUID REFERENCES visual_beats(id) ON DELETE SET NULL,
    CONSTRAINT uk_hook_plans_chapter UNIQUE (chapter_id)
);

-- 3. Retention Maps (tension curve, curiosity loops, pacing)
CREATE TABLE retention_maps (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    tension_curve_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    open_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolved_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    pacing_warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT uk_retention_maps_chapter UNIQUE (chapter_id)
);

-- 4. Attention Events (sensory and narrative shifts)
CREATE TABLE attention_events (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_map_id UUID NOT NULL REFERENCES retention_maps(id) ON DELETE CASCADE,
    event_type VARCHAR(48) NOT NULL,
    time_offset_ms BIGINT NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    severity VARCHAR(24) NOT NULL DEFAULT 'INFO',
    CONSTRAINT ck_attention_events_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'))
);

-- 5. Shot Sequences (container of shots belonging to a dramatic VisualBeat)
CREATE TABLE shot_sequences (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_shot_sequences_beat UNIQUE (visual_beat_id)
);

-- 6. Shots (the atomic production unit)
CREATE TABLE shots (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sequence_id UUID NOT NULL REFERENCES shot_sequences(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    narrative_purpose TEXT NOT NULL DEFAULT '',
    retention_role VARCHAR(32),
    subjects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    location_ref VARCHAR(128),
    start_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    end_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    composition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    camera_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    subject_motion_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    camera_motion_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    environment_motion_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_duration_ms BIGINT NOT NULL DEFAULT 4000,
    generation_strategy VARCHAR(32) NOT NULL DEFAULT 'TEXT_TO_VIDEO',
    quality_profile VARCHAR(64) NOT NULL DEFAULT '720p_24fps_standard',
    continuity_from_shot_id UUID REFERENCES shots(id) ON DELETE SET NULL,
    continuity_to_shot_id UUID REFERENCES shots(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
    CONSTRAINT uk_shots_sequence_order UNIQUE (sequence_id, order_index),
    CONSTRAINT ck_shots_generation_strategy CHECK (generation_strategy IN ('TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'FIRST_LAST_FRAME', 'MULTI_KEYFRAME', 'VIDEO_EXTEND', 'VIDEO_RETAKE')),
    CONSTRAINT ck_shots_status CHECK (status IN ('PLANNED', 'REFERENCE_PREPARING', 'READY', 'QUEUED', 'GENERATING', 'GENERATED', 'VALIDATING', 'PASSED', 'FAILED', 'RETRY_READY', 'MANUAL_REVIEW', 'SELECTED'))
);

-- 7. Takes (individual generation attempts per shot)
CREATE TABLE takes (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'ltx',
    model VARCHAR(64) NOT NULL DEFAULT 'ltx-2.5-nvfp4',
    generation_mode VARCHAR(32) NOT NULL DEFAULT 'TEXT_TO_VIDEO',
    output_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    source_duration_ms BIGINT,
    metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    validation_failure_category VARCHAR(64),
    validation_failure_reason TEXT,
    validation_retry_recommendation TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT uk_takes_shot_attempt UNIQUE (shot_id, attempt_number),
    CONSTRAINT ck_takes_status CHECK (status IN ('PENDING', 'RUNNING', 'GENERATED', 'VALIDATING', 'PASSED', 'FAILED'))
);

-- 8. Selected Takes (binding approved take with in/out trim to timeline)
CREATE TABLE selected_takes (
    shot_id UUID PRIMARY KEY REFERENCES shots(id) ON DELETE CASCADE,
    take_id UUID NOT NULL REFERENCES takes(id) ON DELETE CASCADE,
    source_in_ms BIGINT NOT NULL DEFAULT 0,
    source_out_ms BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_selected_takes_in_out CHECK (source_out_ms > source_in_ms)
);

-- 9. Generation References (reference assets conditioning a shot)
CREATE TABLE generation_references (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    reference_type VARCHAR(48) NOT NULL,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    weight NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    CONSTRAINT ck_generation_references_type CHECK (reference_type IN ('CHARACTER_REFERENCE', 'WARDROBE_REFERENCE', 'LOCATION_REFERENCE', 'START_FRAME', 'END_FRAME', 'KEYFRAME', 'THUMBNAIL', 'POSTER'))
);

-- 10. Production Insights (post-publish retention observation feedback)
CREATE TABLE production_insights (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    observation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendation_text TEXT NOT NULL DEFAULT '',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW'
);

-- 11. Update ProductionMode constraints on media_plans and generation_jobs
ALTER TABLE media_plans DROP CONSTRAINT IF EXISTS ck_media_plans_production_mode;
ALTER TABLE media_plans ADD CONSTRAINT ck_media_plans_production_mode CHECK (production_mode IN ('IMAGE_MOTION', 'VIDEO_FIRST', 'LEGACY_IMAGE'));

ALTER TABLE generation_jobs DROP CONSTRAINT IF EXISTS ck_generation_jobs_production_mode;
ALTER TABLE generation_jobs ADD CONSTRAINT ck_generation_jobs_production_mode CHECK (production_mode IS NULL OR production_mode IN ('IMAGE_MOTION', 'VIDEO_FIRST', 'LEGACY_IMAGE'));

-- 12. Enforce Scene and StoryBeat integrity on VisualBeats (ADR-0024, ADR-0027)
ALTER TABLE visual_beats
    ADD CONSTRAINT fk_visual_beats_scene_story_beat
    FOREIGN KEY (scene_id, story_beat_id)
    REFERENCES story_beats(scene_id, id)
    ON DELETE CASCADE;
