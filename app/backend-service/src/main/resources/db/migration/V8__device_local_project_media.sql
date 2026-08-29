-- Device-local project media ownership.
-- Project media is scoped directly to one project. Account-shared R2 media is reserved
-- for reusable voice-reference audio and therefore has no project_id.

ALTER TABLE media_assets
    ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Only the account-owned voice-reference flow relies on the column default. Project
-- media creators always write PROJECT_LOCAL or LOCAL_ONLY explicitly.
ALTER TABLE media_assets
    ALTER COLUMN storage_mode SET DEFAULT 'REMOTE';

ALTER TABLE media_assets
    DROP CONSTRAINT ck_media_assets_storage_mode;

ALTER TABLE media_assets
    ADD CONSTRAINT ck_media_assets_storage_scope CHECK (
        (storage_mode = 'REMOTE'
            AND project_id IS NULL
            AND asset_type = 'AUDIO'
            AND storage_key IS NOT NULL)
        OR
        (storage_mode = 'PROJECT_LOCAL'
            AND project_id IS NOT NULL
            AND storage_key IS NOT NULL)
        OR
        (storage_mode = 'LOCAL_ONLY'
            AND project_id IS NOT NULL
            AND storage_key IS NULL)
    ) NOT VALID;

CREATE INDEX ix_media_assets_project_ready
    ON media_assets(project_id, asset_type, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- This registry was introduced as an indirect way to infer project ownership, but
-- no runtime writer exists. Direct media_assets.project_id ownership replaces it.
DROP TABLE local_media_materializations;
