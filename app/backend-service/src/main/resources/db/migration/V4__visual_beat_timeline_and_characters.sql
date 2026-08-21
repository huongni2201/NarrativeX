-- Visual beat narration alignment, camera framing, and character continuity.

ALTER TABLE visual_beats
    ADD COLUMN text_start INTEGER,
    ADD COLUMN text_end INTEGER,
    ADD COLUMN audio_start_ms BIGINT,
    ADD COLUMN audio_end_ms BIGINT,
    ADD COLUMN camera_angle VARCHAR(40);

ALTER TABLE visual_beats
    ADD CONSTRAINT ck_visual_beats_text_start_nonnegative
        CHECK (text_start IS NULL OR text_start >= 0),
    ADD CONSTRAINT ck_visual_beats_text_range
        CHECK (text_end IS NULL OR (text_start IS NOT NULL AND text_end >= text_start)),
    ADD CONSTRAINT ck_visual_beats_audio_start_nonnegative
        CHECK (audio_start_ms IS NULL OR audio_start_ms >= 0),
    ADD CONSTRAINT ck_visual_beats_audio_range
        CHECK (audio_end_ms IS NULL OR (audio_start_ms IS NOT NULL AND audio_end_ms >= audio_start_ms)),
    ADD CONSTRAINT ck_visual_beats_camera_angle
        CHECK (camera_angle IS NULL OR camera_angle IN (
            'WIDE',
            'MEDIUM',
            'CLOSE_UP',
            'EXTREME_CLOSE_UP',
            'LOW_ANGLE',
            'HIGH_ANGLE',
            'OVER_THE_SHOULDER',
            'POV'
        ));

CREATE TABLE visual_beat_characters (
    visual_beat_id BIGINT NOT NULL REFERENCES visual_beats(id) ON DELETE CASCADE,
    project_character_id BIGINT NOT NULL REFERENCES project_characters(id) ON DELETE CASCADE,
    role VARCHAR(24) NOT NULL DEFAULT 'SECONDARY',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_visual_beat_characters PRIMARY KEY (visual_beat_id, project_character_id),
    CONSTRAINT ck_visual_beat_characters_role
        CHECK (role IN ('PRIMARY', 'SECONDARY', 'BACKGROUND'))
);

CREATE INDEX idx_visual_beat_characters_project_character
    ON visual_beat_characters (project_character_id, visual_beat_id);

CREATE INDEX idx_visual_beats_audio_range
    ON visual_beats (scene_id, audio_start_ms, audio_end_ms, order_index)
    WHERE audio_start_ms IS NOT NULL;
