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
