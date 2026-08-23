-- Normalize character reference images onto canonical media_assets.
-- This migration is the final fresh-database character-reference schema; no legacy
-- character_versions.master_asset_id/reference_asset_ids compatibility is retained.

CREATE TABLE character_version_reference_assets (
    character_version_id BIGINT NOT NULL REFERENCES character_versions(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    reference_role VARCHAR(24) NOT NULL,
    priority SMALLINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_character_version_reference_assets PRIMARY KEY (character_version_id, media_asset_id),
    CONSTRAINT uq_character_version_reference_priority UNIQUE (character_version_id, priority),
    CONSTRAINT ck_character_version_reference_role CHECK (
        reference_role IN ('IDENTITY', 'PROFILE', 'EXPRESSION', 'OUTFIT', 'POSE')
    ),
    CONSTRAINT ck_character_version_reference_priority CHECK (priority BETWEEN 0 AND 99)
);

CREATE INDEX idx_character_version_reference_asset
    ON character_version_reference_assets (media_asset_id);

COMMENT ON TABLE character_version_reference_assets IS
    'FK-backed immutable character-version references. priority 0 is the preferred identity reference.';

ALTER TABLE character_versions
    DROP COLUMN IF EXISTS master_asset_id,
    DROP COLUMN IF EXISTS reference_asset_ids;
