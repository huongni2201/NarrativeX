-- Full-chapter narration snapshots, durable media assets and segment-level alignment.
ALTER TABLE generation_jobs DROP CONSTRAINT ck_generation_jobs_job_type;
ALTER TABLE generation_jobs ADD CONSTRAINT ck_generation_jobs_job_type CHECK (job_type IN (
    'STORY_ANALYZE', 'CHAPTER_ANALYZE', 'NARRATION_GENERATE', 'IMAGE_GENERATE',
    'CHAPTER_GENERATE', 'CHAPTER_RENDER', 'PROJECT_CONTINUE', 'VISUAL_BEAT_PLAN',
    'SHOT_IMAGE_GENERATE', 'RENDER_PROJECT', 'RENDER_SHORT'
));

CREATE TABLE narration_requests (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    chapter_id BIGINT NOT NULL REFERENCES chapters(id),
    chapter_row_version BIGINT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    source_text TEXT NOT NULL,
    voice_id VARCHAR(160) NOT NULL,
    language VARCHAR(16) NOT NULL,
    speaking_rate NUMERIC(8, 4) NOT NULL,
    segmentation_version VARCHAR(64) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    CONSTRAINT uk_narration_requests_fingerprint UNIQUE (request_fingerprint),
    CONSTRAINT ck_narration_requests_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_requests_speaking_rate CHECK (speaking_rate > 0)
);
CREATE INDEX idx_narration_requests_chapter_created
    ON narration_requests (chapter_id, created_at DESC);

CREATE TABLE narration_operations (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    narration_request_id UUID NOT NULL REFERENCES narration_requests(id),
    generation_job_id BIGINT NOT NULL UNIQUE REFERENCES generation_jobs(id),
    stage_attempt_id BIGINT NOT NULL UNIQUE REFERENCES stage_attempts(id),
    CONSTRAINT uk_narration_operations_request_job UNIQUE (narration_request_id, generation_job_id)
);

CREATE TABLE narration_assets (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    narration_request_id UUID NOT NULL UNIQUE REFERENCES narration_requests(id),
    project_asset_id BIGINT NOT NULL UNIQUE REFERENCES project_assets(id),
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
