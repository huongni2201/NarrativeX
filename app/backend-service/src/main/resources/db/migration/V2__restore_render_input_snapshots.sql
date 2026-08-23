-- Restore the durable render-admission snapshot tables consumed by the backend
-- and AI render worker. These tables were referenced by the MyBatis mapper and
-- worker after the consolidated V1 baseline, but were missing from that schema.

CREATE TABLE render_input_snapshots (
    generation_job_id BIGINT PRIMARY KEY
        REFERENCES generation_jobs(id) ON DELETE CASCADE,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    media_plan_revision INTEGER NOT NULL CHECK (media_plan_revision > 0),
    narration_request_id UUID REFERENCES narration_requests(id),
    narration_asset_id UUID REFERENCES narration_assets(id),
    narration_alignment_id UUID REFERENCES narration_alignments(id),
    audio_storage_key VARCHAR(512),
    audio_size_bytes BIGINT,
    audio_checksum VARCHAR(64),
    audio_duration_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_render_input_snapshots_audio_complete CHECK (
        (
            narration_request_id IS NULL
            AND narration_asset_id IS NULL
            AND audio_storage_key IS NULL
            AND audio_size_bytes IS NULL
            AND audio_checksum IS NULL
            AND audio_duration_ms IS NULL
        )
        OR
        (
            narration_request_id IS NOT NULL
            AND narration_asset_id IS NOT NULL
            AND audio_storage_key IS NOT NULL
            AND audio_size_bytes > 0
            AND audio_checksum ~ '^[0-9a-f]{64}$'
            AND audio_duration_ms > 0
        )
    )
);
CREATE INDEX idx_render_input_snapshots_media_plan
    ON render_input_snapshots (media_plan_id, media_plan_revision);

CREATE TABLE render_input_snapshot_beats (
    generation_job_id BIGINT NOT NULL
        REFERENCES generation_jobs(id) ON DELETE CASCADE,
    scene_index INTEGER NOT NULL CHECK (scene_index >= 0),
    beat_index INTEGER NOT NULL CHECK (beat_index >= 0),
    visual_beat_id BIGINT NOT NULL REFERENCES visual_beats(id),
    media_generation_item_id UUID NOT NULL REFERENCES media_generation_items(id),
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    duration_ms BIGINT,
    camera_movement VARCHAR(32) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (generation_job_id, scene_index, beat_index),
    CONSTRAINT ck_render_input_snapshot_beats_duration
        CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT ck_render_input_snapshot_beats_camera CHECK (
        camera_movement IN (
            'NONE', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK',
            'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX'
        )
    ),
    CONSTRAINT ck_render_input_snapshot_beats_checksum
        CHECK (checksum ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_render_input_snapshot_beats_visual_beat
    ON render_input_snapshot_beats (visual_beat_id);
CREATE INDEX idx_render_input_snapshot_beats_media_asset
    ON render_input_snapshot_beats (media_asset_id);

CREATE OR REPLACE FUNCTION reject_render_input_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new render generation job instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_render_input_snapshots_immutable
BEFORE UPDATE ON render_input_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_render_input_snapshot_update();

CREATE TRIGGER trg_render_input_snapshot_beats_immutable
BEFORE UPDATE ON render_input_snapshot_beats
FOR EACH ROW EXECUTE FUNCTION reject_render_input_snapshot_update();

COMMENT ON TABLE render_input_snapshots IS
    'Immutable chapter-render admission snapshot pinned to one generation job and media-plan revision.';
COMMENT ON TABLE render_input_snapshot_beats IS
    'Immutable READY image inputs selected for each planned render beat at admission time.';
