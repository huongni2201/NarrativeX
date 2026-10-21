-- Persist one complete AudioCue playback owner per Shot in a ShotSequence.
-- Native AV does not yet support splitting a single AudioCue across Takes.

CREATE TABLE shot_audio_cue_allocation_sets (
    sequence_id UUID PRIMARY KEY REFERENCES shot_sequences(id) ON DELETE CASCADE,
    row_version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_shot_audio_cue_allocation_sets_row_version CHECK (row_version >= 0)
);

CREATE TABLE shot_audio_cue_allocations (
    audio_cue_id UUID PRIMARY KEY REFERENCES audio_cues(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES shot_sequences(id) ON DELETE CASCADE,
    shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    audio_cue_row_version BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_shot_audio_cue_allocation_row_version CHECK (audio_cue_row_version >= 0)
);

CREATE INDEX idx_shot_audio_cue_allocations_sequence_shot
    ON shot_audio_cue_allocations (sequence_id, shot_id, audio_cue_id);
