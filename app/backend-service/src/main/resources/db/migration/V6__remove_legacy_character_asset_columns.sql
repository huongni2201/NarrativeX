-- Character-version media references are normalized in V5 through
-- character_version_reference_assets -> media_assets.
-- These JSON/Long columns represented the retired pre-V5 asset model.
ALTER TABLE character_versions
    DROP COLUMN IF EXISTS master_asset_id,
    DROP COLUMN IF EXISTS reference_asset_ids;
