-- Hard-cut narration timing to authoritative word-level alignment.
-- NarrativeX is pre-release: no compatibility columns or dual-read path are retained.

ALTER TABLE narration_alignments
    RENAME COLUMN spans_json TO words_json;

ALTER TABLE narration_alignments
    RENAME CONSTRAINT ck_narration_alignments_spans_array
    TO ck_narration_alignments_words_array;

ALTER TABLE project_render_input_chapters
    RENAME COLUMN subtitle_spans_json TO subtitle_words_json;

ALTER TABLE project_render_input_chapters
    RENAME CONSTRAINT ck_project_render_subtitle_spans_array
    TO ck_project_render_subtitle_words_array;

COMMENT ON COLUMN narration_alignments.words_json IS
    'Authoritative spoken-word alignment [{index,textStart,textEnd,audioStartMs,audioEndMs,confidence}]. Silence is intentionally not represented.';

COMMENT ON COLUMN project_render_input_chapters.subtitle_words_json IS
    'Immutable narration word alignment used for exact subtitle timing; subtitles need not cover leading, inter-word, or trailing silence.';
