-- -----------------------------------------------------------------------------
-- Visual beat preview asset linkage
-- -----------------------------------------------------------------------------

ALTER TABLE visual_beats
    ADD COLUMN preview_asset_id BIGINT
        REFERENCES project_assets(id) ON DELETE SET NULL;

CREATE INDEX idx_visual_beats_preview_asset
    ON visual_beats (preview_asset_id)
    WHERE preview_asset_id IS NOT NULL;
