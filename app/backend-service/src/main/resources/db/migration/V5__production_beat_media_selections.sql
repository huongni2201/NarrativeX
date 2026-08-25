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

-- Render jobs snapshot editor media choices immutably. LOCAL_ONLY media deliberately
-- has no backend storage key; the assigned Desktop resolves it by stable mediaAssetId
-- from its project.manifest.json.
ALTER TABLE project_render_input_beats
    ALTER COLUMN storage_key DROP NOT NULL,
    ADD COLUMN media_type VARCHAR(16) NOT NULL DEFAULT 'IMAGE',
    ADD COLUMN storage_mode VARCHAR(24) NOT NULL DEFAULT 'REMOTE',
    ADD COLUMN source_duration_ms BIGINT,
    ADD COLUMN fit_mode VARCHAR(24) NOT NULL DEFAULT 'TRIM',
    ADD COLUMN trim_start_ms BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN media_selection_active BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT ck_project_render_input_beat_media_type CHECK (media_type IN ('IMAGE', 'VIDEO')),
    ADD CONSTRAINT ck_project_render_input_beat_storage_mode CHECK (storage_mode IN ('REMOTE', 'LOCAL_ONLY', 'HYBRID')),
    ADD CONSTRAINT ck_project_render_input_beat_source_duration CHECK (source_duration_ms IS NULL OR source_duration_ms > 0),
    ADD CONSTRAINT ck_project_render_input_beat_fit_mode CHECK (fit_mode IN ('TRIM', 'LOOP', 'FREEZE_END', 'SPEED_ADJUST')),
    ADD CONSTRAINT ck_project_render_input_beat_trim_start CHECK (trim_start_ms >= 0);
