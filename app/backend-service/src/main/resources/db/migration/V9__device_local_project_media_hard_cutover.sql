-- Hard cutover: project media is always project-owned/local; custom voice references are account-owned/R2.

CREATE TABLE voice_reference_assets (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    detected_content_type VARCHAR(160),
    detected_container VARCHAR(64),
    detected_codec VARCHAR(64),
    validation_error_code VARCHAR(96),
    validation_error_detail VARCHAR(1024),
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_voice_reference_assets_account_checksum UNIQUE (account_id, sha256),
    CONSTRAINT ck_voice_reference_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_voice_reference_assets_sha CHECK (char_length(sha256) = 64),
    CONSTRAINT ck_voice_reference_assets_storage_key CHECK (storage_key LIKE 'voices/%'),
    CONSTRAINT ck_voice_reference_assets_status CHECK (
        status IN ('VALIDATING', 'READY', 'REJECTED', 'DELETED')
    )
);

-- Preserve any pre-cutover account-level R2 voice rows before project media becomes project-only.
INSERT INTO voice_reference_assets (
    id,
    account_id,
    storage_key,
    original_filename,
    content_type,
    size_bytes,
    sha256,
    status,
    detected_content_type,
    detected_container,
    detected_codec,
    validation_error_code,
    validation_error_detail,
    validated_at,
    created_at,
    updated_at,
    row_version
)
SELECT id,
       account_id,
       storage_key,
       original_filename,
       content_type,
       size_bytes,
       sha256,
       status,
       detected_content_type,
       detected_container,
       detected_codec,
       validation_error_code,
       validation_error_detail,
       validated_at,
       created_at,
       updated_at,
       row_version
  FROM media_assets
 WHERE project_id IS NULL
   AND asset_type = 'AUDIO'
   AND storage_key LIKE 'voices/%'
ON CONFLICT (id) DO NOTHING;

-- Upload/validation lifecycle now points at account-level voice reference assets.
ALTER TABLE media_upload_sessions
    DROP CONSTRAINT IF EXISTS media_upload_sessions_media_asset_id_fkey;
ALTER TABLE media_upload_sessions
    ADD CONSTRAINT media_upload_sessions_media_asset_id_fkey
    FOREIGN KEY (media_asset_id) REFERENCES voice_reference_assets(id) ON DELETE SET NULL;

ALTER TABLE media_validation_jobs
    DROP CONSTRAINT IF EXISTS media_validation_jobs_media_asset_id_fkey;
ALTER TABLE media_validation_jobs
    ADD CONSTRAINT media_validation_jobs_media_asset_id_fkey
    FOREIGN KEY (media_asset_id) REFERENCES voice_reference_assets(id) ON DELETE CASCADE;

-- Generic account-level checksum reuse belongs to voice references, not project media.
DROP TABLE IF EXISTS media_asset_checksums;

-- Remove migrated account-level rows before enforcing project ownership.
DELETE FROM media_assets WHERE project_id IS NULL;

ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS ck_media_assets_storage_scope;
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS ck_media_assets_storage_mode;
ALTER TABLE media_assets ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE media_assets DROP COLUMN storage_mode;

-- Render snapshots no longer encode a storage-mode enum: every input is local before render.
ALTER TABLE project_render_input_beats
    DROP CONSTRAINT IF EXISTS ck_project_render_input_beats_storage_mode;
ALTER TABLE project_render_input_beats
    DROP COLUMN IF EXISTS storage_mode;

-- This registry was previously used as an indirect ownership signal. Ownership is now media_assets.project_id.
DROP TABLE IF EXISTS local_media_materializations CASCADE;

CREATE INDEX ix_media_assets_project_created
    ON media_assets (account_id, project_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX ix_voice_reference_assets_account_created
    ON voice_reference_assets (account_id, created_at DESC, id DESC)
    WHERE status <> 'DELETED';
