-- A checksum claim is the canonical owner of verified bytes for one account.
-- It intentionally exists independently from the asset lifecycle so a
-- validating candidate cannot race another finalization request.
CREATE TABLE media_asset_checksums (
    account_id VARCHAR(128) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    media_asset_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_media_asset_checksums PRIMARY KEY (account_id, sha256),
    CONSTRAINT ck_media_asset_checksums_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT fk_media_asset_checksums_asset
        FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_media_asset_checksums_asset
    ON media_asset_checksums (media_asset_id);

-- Preserve canonical identity for assets created by the previous lifecycle.
INSERT INTO media_asset_checksums (account_id, sha256, media_asset_id)
SELECT account_id, sha256, id
  FROM media_assets
 WHERE checksum_verified_at IS NOT NULL
   AND status <> 'DELETED'
   AND deleted_at IS NULL
ON CONFLICT (account_id, sha256) DO NOTHING;

DROP INDEX uq_media_assets_account_sha256_verified;

ALTER TABLE media_upload_sessions
    DROP CONSTRAINT ck_media_upload_sessions_status;

ALTER TABLE media_upload_sessions
    ADD CONSTRAINT ck_media_upload_sessions_status
    CHECK (status IN ('PENDING_UPLOAD', 'VALIDATING', 'READY', 'REJECTED'));
