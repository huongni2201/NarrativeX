-- MediaAsset lifecycle hardening. PostgreSQL remains authoritative for status and deduplication.

ALTER TABLE media_assets
    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN checksum_verified_at TIMESTAMP WITH TIME ZONE;

UPDATE media_assets
   SET status = 'UPLOADING'
 WHERE status = 'UPLOADED';

ALTER TABLE media_assets
    DROP CONSTRAINT ck_media_assets_status;

ALTER TABLE media_assets
    ADD CONSTRAINT ck_media_assets_status
        CHECK (status IN ('PENDING_UPLOAD', 'UPLOADING', 'VALIDATING', 'READY', 'REJECTED', 'DELETED'));

-- Existing READY rows were created by the trusted database seed/baseline and are treated as verified.
UPDATE media_assets
   SET checksum_verified_at = COALESCE(checksum_verified_at, created_at)
 WHERE status = 'READY';

CREATE UNIQUE INDEX uq_media_assets_account_sha256_verified
    ON media_assets (account_id, sha256)
    WHERE checksum_verified_at IS NOT NULL AND status <> 'DELETED' AND deleted_at IS NULL;

CREATE INDEX idx_media_assets_account_created_visible
    ON media_assets (account_id, created_at DESC, id DESC)
    WHERE status <> 'DELETED' AND deleted_at IS NULL;
