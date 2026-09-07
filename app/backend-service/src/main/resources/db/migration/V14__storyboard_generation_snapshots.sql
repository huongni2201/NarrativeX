CREATE TABLE storyboard_generation_batches (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    storyboard_revision_id UUID NOT NULL REFERENCES storyboard_revisions(id),
    source_hash VARCHAR(64) NOT NULL,
    continuity_plan_id UUID REFERENCES chapter_continuity_plans(id),
    continuity_plan_revision INTEGER,
    continuity_report_revision INTEGER,
    style_policy_version VARCHAR(64) NOT NULL,
    provider_policy_version VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'PREPARED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_storyboard_generation_batch_idempotency
        UNIQUE (project_id, chapter_id, idempotency_key),
    CONSTRAINT ck_storyboard_generation_batch_source_hash
        CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_storyboard_generation_batch_fingerprint
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_storyboard_generation_batch_issues
        CHECK (jsonb_typeof(issues_json) = 'array')
);

CREATE TABLE storyboard_generation_beat_snapshots (
    id UUID PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES storyboard_generation_batches(id) ON DELETE CASCADE,
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id),
    scene_id UUID NOT NULL REFERENCES scenes(id),
    beat_row_version BIGINT NOT NULL,
    prompt TEXT NOT NULL,
    negative_prompt TEXT NOT NULL DEFAULT '',
    character_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    continuity_semantic_hash VARCHAR(128),
    input_fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_storyboard_generation_beat_snapshot UNIQUE (batch_id, visual_beat_id),
    CONSTRAINT ck_storyboard_generation_beat_prompt CHECK (length(prompt) BETWEEN 1 AND 16000),
    CONSTRAINT ck_storyboard_generation_beat_character_snapshot CHECK (jsonb_typeof(character_snapshot_json) = 'object'),
    CONSTRAINT ck_storyboard_generation_beat_references CHECK (jsonb_typeof(references_json) = 'array'),
    CONSTRAINT ck_storyboard_generation_beat_fingerprint CHECK (input_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_storyboard_generation_batches_scope
    ON storyboard_generation_batches (project_id, chapter_id, created_at DESC);
CREATE INDEX idx_storyboard_generation_beat_snapshot_beat
    ON storyboard_generation_beat_snapshots (visual_beat_id, created_at DESC);
