-- Pin every render input at admission time so crash/reclaim cannot switch to newer media.

CREATE TABLE render_input_snapshots (
    generation_job_id BIGINT PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
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
    CONSTRAINT ck_render_input_snapshot_audio_bundle CHECK (
        (
            narration_request_id IS NULL
            AND narration_asset_id IS NULL
            AND narration_alignment_id IS NULL
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
            AND audio_size_bytes IS NOT NULL
            AND audio_size_bytes > 0
            AND audio_checksum IS NOT NULL
            AND audio_checksum ~ '^[0-9a-f]{64}$'
            AND audio_duration_ms IS NOT NULL
            AND audio_duration_ms > 0
        )
    )
);

CREATE TABLE render_input_snapshot_beats (
    generation_job_id BIGINT NOT NULL
        REFERENCES render_input_snapshots(generation_job_id) ON DELETE CASCADE,
    scene_index INTEGER NOT NULL CHECK (scene_index >= 0),
    beat_index INTEGER NOT NULL CHECK (beat_index >= 0),
    visual_beat_id BIGINT NOT NULL REFERENCES visual_beats(id),
    media_generation_item_id UUID NOT NULL REFERENCES media_generation_items(id),
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    duration_ms BIGINT,
    camera_movement VARCHAR(64) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_render_input_snapshot_beats
        PRIMARY KEY (generation_job_id, scene_index, beat_index),
    CONSTRAINT uq_render_input_snapshot_beats_visual
        UNIQUE (generation_job_id, visual_beat_id),
    CONSTRAINT ck_render_input_snapshot_beats_duration
        CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT ck_render_input_snapshot_beats_checksum
        CHECK (checksum ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_render_input_snapshot_beats_job
    ON render_input_snapshot_beats (generation_job_id, scene_index, beat_index);

CREATE OR REPLACE FUNCTION reject_render_input_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable once a render job is admitted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_render_input_snapshots_immutable
BEFORE UPDATE ON render_input_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_render_input_snapshot_update();

CREATE TRIGGER trg_render_input_snapshot_beats_immutable
BEFORE UPDATE ON render_input_snapshot_beats
FOR EACH ROW EXECUTE FUNCTION reject_render_input_snapshot_update();
