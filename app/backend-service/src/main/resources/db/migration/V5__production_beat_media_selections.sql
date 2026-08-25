-- Durable non-destructive editor selection for the media used by each VisualBeat.
-- Scene and Chapter remain logical groups; the selected media is resolved when the
-- production timeline/render snapshot is built.

CREATE TABLE production_beat_media_selections (
    id UUID PRIMARY KEY DEFAULT narrativex_uuid_v7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    visual_beat_id UUID NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    fit_mode VARCHAR(24) NOT NULL DEFAULT 'TRIM',
    trim_start_ms BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_production_beat_media_selection UNIQUE (project_id, visual_beat_id),
    CONSTRAINT ck_production_beat_media_selection_fit_mode
        CHECK (fit_mode IN ('TRIM', 'LOOP', 'FREEZE_END', 'SPEED_ADJUST')),
    CONSTRAINT ck_production_beat_media_selection_trim_start CHECK (trim_start_ms >= 0)
);

CREATE INDEX idx_production_beat_media_selection_asset
    ON production_beat_media_selections (media_asset_id);
