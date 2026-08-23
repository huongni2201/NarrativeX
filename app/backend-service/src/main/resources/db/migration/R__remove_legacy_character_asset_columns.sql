-- Remove legacy character-version asset columns that were retired when
-- character references moved to character_version_reference_assets -> media_assets.
--
-- Keep this as a repeatable migration so the consolidated V1 baseline remains
-- the only versioned migration while fresh databases still converge to the
-- canonical schema.

ALTER TABLE character_versions
    DROP COLUMN IF EXISTS master_asset_id,
    DROP COLUMN IF EXISTS reference_asset_ids;
