-- NarrativeX pre-release baseline: narration/alignment, notifications/outbox, and artifact metadata.

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
    voice_reference_asset_id UUID REFERENCES voice_reference_assets(id),
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
    words_json JSONB NOT NULL,
    CONSTRAINT uk_narration_alignments_asset_version UNIQUE (narration_asset_id, alignment_version),
    CONSTRAINT ck_narration_alignments_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_narration_alignments_words_array CHECK (jsonb_typeof(words_json) = 'array')
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
    narration_set_id UUID NOT NULL UNIQUE REFERENCES narration_sets(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    text_content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_documents_hash CHECK (content_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE narration_audio_tracks (
    id UUID PRIMARY KEY,
    narration_set_id UUID NOT NULL UNIQUE REFERENCES narration_sets(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    format VARCHAR(16) NOT NULL,
    duration_ms BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_audio_tracks_duration CHECK (duration_ms > 0),
    CONSTRAINT ck_narration_audio_tracks_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE narration_alignment_runs (
    id UUID PRIMARY KEY,
    narration_set_id UUID NOT NULL REFERENCES narration_sets(id) ON DELETE CASCADE,
    narration_audio_track_id UUID NOT NULL REFERENCES narration_audio_tracks(id) ON DELETE CASCADE,
    run_fingerprint VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    engine VARCHAR(32) NOT NULL,
    engine_version VARCHAR(32) NOT NULL,
    granularity VARCHAR(16) NOT NULL,
    aligned_words_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_alignment_runs_status CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_narration_alignment_runs_granularity CHECK (granularity IN ('WORD', 'SEGMENT')),
    CONSTRAINT ck_narration_alignment_runs_fingerprint CHECK (run_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uk_narration_alignment_runs_fingerprint UNIQUE (run_fingerprint)
);

CREATE TABLE narration_spans (
    id UUID PRIMARY KEY,
    narration_alignment_run_id UUID NOT NULL REFERENCES narration_alignment_runs(id) ON DELETE CASCADE,
    span_index INTEGER NOT NULL,
    text_start INTEGER NOT NULL,
    text_end INTEGER NOT NULL,
    audio_start_ms BIGINT NOT NULL,
    audio_end_ms BIGINT NOT NULL,
    confidence NUMERIC(5, 4),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_narration_spans_index CHECK (span_index >= 0),
    CONSTRAINT ck_narration_spans_text CHECK (text_end > text_start AND text_start >= 0),
    CONSTRAINT ck_narration_spans_audio CHECK (audio_end_ms >= audio_start_ms AND audio_start_ms >= 0),
    CONSTRAINT ck_narration_spans_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CONSTRAINT uk_narration_spans_run_index UNIQUE (narration_alignment_run_id, span_index)
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
-- Render manifests and final artifacts
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
