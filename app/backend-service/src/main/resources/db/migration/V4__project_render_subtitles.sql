ALTER TABLE project_render_input_chapters
    ADD COLUMN subtitle_text TEXT NOT NULL DEFAULT '',
    ADD COLUMN subtitle_spans_json JSONB;

ALTER TABLE project_render_input_chapters
    ADD CONSTRAINT ck_project_render_subtitle_spans_array
    CHECK (subtitle_spans_json IS NULL OR jsonb_typeof(subtitle_spans_json) = 'array');

COMMENT ON COLUMN project_render_input_chapters.subtitle_text IS
    'Immutable narration source text captured when the project render job is admitted.';
COMMENT ON COLUMN project_render_input_chapters.subtitle_spans_json IS
    'Immutable narration alignment spans [{index,textStart,textEnd,audioStartMs,audioEndMs}] used for subtitle timing.';
