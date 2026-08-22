ALTER TABLE narration_requests
    ADD COLUMN voice_reference_asset_id UUID REFERENCES media_assets(id);

CREATE INDEX idx_narration_requests_voice_reference_asset
    ON narration_requests (voice_reference_asset_id)
    WHERE voice_reference_asset_id IS NOT NULL;
