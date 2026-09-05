-- NarrativeX pre-release baseline slice: immutable chapter continuity planning and beat state.

-- Composite keys used to fence continuity rows to the same project/story/chapter graph.
ALTER TABLE story_versions
    ADD CONSTRAINT uq_story_versions_project_id_id UNIQUE (project_id, id);
ALTER TABLE chapters
    ADD CONSTRAINT uq_chapters_story_version_id_id UNIQUE (story_version_id, id);
ALTER TABLE storyboard_revisions
    ADD CONSTRAINT uq_storyboard_revisions_chapter_id_id UNIQUE (chapter_id, id);
ALTER TABLE scenes
    ADD CONSTRAINT uq_scenes_chapter_id_id UNIQUE (chapter_id, id);
ALTER TABLE visual_beats
    ADD CONSTRAINT uq_visual_beats_scene_id_id UNIQUE (scene_id, id);

CREATE TABLE chapter_continuity_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL,
    story_version_id UUID NOT NULL,
    chapter_id UUID NOT NULL,
    storyboard_revision_id UUID NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    source_hash VARCHAR(64) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    prompt_version VARCHAR(64) NOT NULL,
    model_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    plan_json JSONB NOT NULL,
    result_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_chapter_continuity_plan_revision UNIQUE (chapter_id, revision),
    CONSTRAINT uq_chapter_continuity_plan_scope UNIQUE (id, project_id, chapter_id),
    CONSTRAINT ck_chapter_continuity_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_chapter_continuity_result_hash CHECK (result_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_chapter_continuity_model_config_object
        CHECK (jsonb_typeof(model_config_json) = 'object'),
    CONSTRAINT ck_chapter_continuity_plan_object CHECK (jsonb_typeof(plan_json) = 'object'),
    CONSTRAINT fk_chapter_continuity_project_story
        FOREIGN KEY (project_id, story_version_id)
        REFERENCES story_versions(project_id, id),
    CONSTRAINT fk_chapter_continuity_story_chapter
        FOREIGN KEY (story_version_id, chapter_id)
        REFERENCES chapters(story_version_id, id),
    CONSTRAINT fk_chapter_continuity_chapter_storyboard
        FOREIGN KEY (chapter_id, storyboard_revision_id)
        REFERENCES storyboard_revisions(chapter_id, id)
);

CREATE TABLE scene_continuity_states (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    plan_id UUID NOT NULL,
    project_id UUID NOT NULL,
    chapter_id UUID NOT NULL,
    scene_id UUID NOT NULL,
    scene_key VARCHAR(64) NOT NULL,
    timeline_key VARCHAR(128) NOT NULL,
    entry_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    exit_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    event_keys_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_scene_continuity_plan_scene UNIQUE (plan_id, scene_id),
    CONSTRAINT uq_scene_continuity_plan_key UNIQUE (plan_id, scene_key),
    CONSTRAINT ck_scene_continuity_key CHECK (scene_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_scene_continuity_entry_array CHECK (jsonb_typeof(entry_facts_json) = 'array'),
    CONSTRAINT ck_scene_continuity_exit_array CHECK (jsonb_typeof(exit_facts_json) = 'array'),
    CONSTRAINT ck_scene_continuity_events_array CHECK (jsonb_typeof(event_keys_json) = 'array'),
    CONSTRAINT fk_scene_continuity_plan_scope
        FOREIGN KEY (plan_id, project_id, chapter_id)
        REFERENCES chapter_continuity_plans(id, project_id, chapter_id) ON DELETE CASCADE,
    CONSTRAINT fk_scene_continuity_chapter_scene
        FOREIGN KEY (chapter_id, scene_id)
        REFERENCES scenes(chapter_id, id) ON DELETE CASCADE
);

CREATE TABLE visual_beat_continuity_states (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    plan_id UUID NOT NULL,
    project_id UUID NOT NULL,
    chapter_id UUID NOT NULL,
    scene_id UUID NOT NULL,
    visual_beat_id UUID NOT NULL,
    beat_key VARCHAR(64) NOT NULL,
    entry_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    visible_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    exit_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    event_keys_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    semantic_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_visual_beat_continuity_plan_beat UNIQUE (plan_id, visual_beat_id),
    CONSTRAINT uq_visual_beat_continuity_plan_key UNIQUE (plan_id, beat_key),
    CONSTRAINT ck_visual_beat_continuity_key CHECK (beat_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_visual_beat_continuity_semantic_hash CHECK (semantic_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_visual_beat_continuity_entry_array CHECK (jsonb_typeof(entry_facts_json) = 'array'),
    CONSTRAINT ck_visual_beat_continuity_visible_array CHECK (jsonb_typeof(visible_facts_json) = 'array'),
    CONSTRAINT ck_visual_beat_continuity_exit_array CHECK (jsonb_typeof(exit_facts_json) = 'array'),
    CONSTRAINT ck_visual_beat_continuity_events_array CHECK (jsonb_typeof(event_keys_json) = 'array'),
    CONSTRAINT fk_visual_beat_continuity_plan_scope
        FOREIGN KEY (plan_id, project_id, chapter_id)
        REFERENCES chapter_continuity_plans(id, project_id, chapter_id) ON DELETE CASCADE,
    CONSTRAINT fk_visual_beat_continuity_chapter_scene
        FOREIGN KEY (chapter_id, scene_id)
        REFERENCES scenes(chapter_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_visual_beat_continuity_scene_beat
        FOREIGN KEY (scene_id, visual_beat_id)
        REFERENCES visual_beats(scene_id, id) ON DELETE CASCADE
);

CREATE TABLE continuity_reports (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    plan_id UUID NOT NULL REFERENCES chapter_continuity_plans(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK (revision > 0),
    status VARCHAR(24) NOT NULL,
    issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    origin VARCHAR(24) NOT NULL DEFAULT 'DETERMINISTIC',
    reviewed_by VARCHAR(128),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_continuity_report_revision UNIQUE (plan_id, revision),
    CONSTRAINT ck_continuity_report_status CHECK (status IN ('PASS', 'NEEDS_REVIEW')),
    CONSTRAINT ck_continuity_report_origin CHECK (origin IN ('DETERMINISTIC', 'SEMANTIC', 'HUMAN')),
    CONSTRAINT ck_continuity_report_issues_array CHECK (jsonb_typeof(issues_json) = 'array'),
    CONSTRAINT ck_continuity_report_review_consistency CHECK (
        (reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);
