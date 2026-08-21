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
    CONSTRAINT ck_media_upload_sessions_status CHECK (status IN ('PENDING_UPLOAD', 'READY', 'REJECTED')),
    CONSTRAINT uk_media_upload_sessions_storage_key UNIQUE (storage_key),
    CONSTRAINT uk_media_upload_sessions_idempotency UNIQUE (account_id, idempotency_key)
);

CREATE INDEX idx_media_upload_sessions_account_status
    ON media_upload_sessions (account_id, status, created_at DESC);
