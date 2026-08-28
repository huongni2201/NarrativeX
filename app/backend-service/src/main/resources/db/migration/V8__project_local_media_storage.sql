-- Pre-release hard cutover: generated project media is stored on the shared local filesystem.
-- R2 remains reserved for account-owned voice-reference assets.

ALTER TABLE media_assets
    DROP CONSTRAINT ck_media_assets_storage_mode;

ALTER TABLE media_assets
    ADD CONSTRAINT ck_media_assets_storage_mode CHECK (
        (storage_mode IN ('REMOTE', 'HYBRID') AND storage_key IS NOT NULL)
        OR (storage_mode = 'LOCAL_ONLY' AND storage_key IS NULL)
        OR (storage_mode = 'PROJECT_LOCAL' AND storage_key IS NOT NULL)
    );
