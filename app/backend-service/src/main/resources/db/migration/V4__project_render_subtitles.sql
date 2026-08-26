ALTER TABLE project_render_input_chapters
    ADD COLUMN subtitle_text TEXT NOT NULL DEFAULT '',
    ADD COLUMN subtitle_spans_json JSONB;

ALTER TABLE project_render_input_chapters
    ADD CONSTRAINT ck_project_render_subtitle_spans_array
    CHECK (subtitle_spans_json IS NULL OR jsonb_typeof(subtitle_spans_json) = 'array');

ALTER TABLE project_render_input_snapshots
    ADD COLUMN background_music_asset_id UUID REFERENCES media_assets(id),
    ADD COLUMN bgm_storage_mode VARCHAR(24),
    ADD COLUMN bgm_storage_key VARCHAR(512),
    ADD COLUMN bgm_size_bytes BIGINT,
    ADD COLUMN bgm_checksum VARCHAR(64),
    ADD COLUMN bgm_duration_ms BIGINT;

ALTER TABLE project_render_input_snapshots
    ADD CONSTRAINT ck_project_render_bgm_complete CHECK (
        (
            background_music_asset_id IS NULL
            AND bgm_storage_mode IS NULL
            AND bgm_storage_key IS NULL
            AND bgm_size_bytes IS NULL
            AND bgm_checksum IS NULL
            AND bgm_duration_ms IS NULL
        )
        OR
        (
            background_music_asset_id IS NOT NULL
            AND bgm_storage_mode IN ('REMOTE', 'LOCAL_ONLY', 'HYBRID')
            AND (
                (bgm_storage_mode = 'LOCAL_ONLY' AND bgm_storage_key IS NULL)
                OR
                (bgm_storage_mode IN ('REMOTE', 'HYBRID') AND bgm_storage_key IS NOT NULL)
            )
            AND bgm_size_bytes > 0
            AND bgm_checksum ~ '^[0-9a-f]{64}$'
            AND bgm_duration_ms > 0
        )
    );

COMMENT ON COLUMN project_render_input_chapters.subtitle_text IS
    'Immutable narration source text captured when the project render job is admitted.';
COMMENT ON COLUMN project_render_input_chapters.subtitle_spans_json IS
    'Immutable narration alignment spans [{index,textStart,textEnd,audioStartMs,audioEndMs}] used for subtitle timing.';
COMMENT ON COLUMN project_render_input_snapshots.background_music_asset_id IS
    'Optional immutable AUDIO asset selected by Auto Edit for narration-aware background music mixing.';
