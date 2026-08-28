ALTER TABLE visual_beats
    ADD COLUMN preview_media_asset_id UUID
        REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX idx_visual_beats_preview_media_asset
    ON visual_beats (preview_media_asset_id)
    WHERE preview_media_asset_id IS NOT NULL;
