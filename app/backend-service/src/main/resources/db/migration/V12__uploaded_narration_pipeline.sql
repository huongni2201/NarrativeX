-- Uploaded narration is a first-class immutable input. It is intentionally separate from the
-- legacy one-request/one-chapter TTS tables introduced in V11.

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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_media_assets_type CHECK (asset_type IN ('AUDIO', 'IMAGE', 'VIDEO')),
    CONSTRAINT ck_media_assets_origin CHECK (origin IN ('USER_UPLOAD', 'TTS_GENERATED', 'IMAGE_GENERATED', 'VIDEO_GENERATED')),
    CONSTRAINT ck_media_assets_status CHECK (status IN ('PENDING_UPLOAD', 'UPLOADED', 'VALIDATING', 'READY', 'REJECTED')),
    CONSTRAINT ck_media_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_media_assets_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_assets_duration CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT uk_media_assets_account_storage_key UNIQUE (account_id, storage_key)
);
CREATE INDEX idx_media_assets_account_status ON media_assets (account_id, status, created_at DESC);

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

-- V11 owns the legacy chapter-level TTS alignment table. This run table is the canonical cache key
-- for multi-chapter/multi-part alignment and avoids changing the old worker contract in place.
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
