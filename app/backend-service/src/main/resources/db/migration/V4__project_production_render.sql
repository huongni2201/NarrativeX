-- Project-level immutable render snapshots for long-form production timelines.
-- Chapter render tables remain unchanged; this slice adds a separate project render boundary.

CREATE TABLE project_render_input_snapshots (
    generation_job_id UUID PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id),
    story_version_id UUID NOT NULL REFERENCES story_versions(id),
    resolution VARCHAR(16) NOT NULL,
    render_format VARCHAR(16) NOT NULL,
    aspect_ratio VARCHAR(16) NOT NULL,
    total_duration_ms BIGINT NOT NULL CHECK (total_duration_ms > 0),
    chapter_count INTEGER NOT NULL CHECK (chapter_count > 0),
    beat_count INTEGER NOT NULL CHECK (beat_count > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_project_render_input_resolution CHECK (resolution IN ('720p', '1080p')),
    CONSTRAINT ck_project_render_input_format CHECK (render_format = 'mp4')
);

CREATE TABLE project_render_input_chapters (
    generation_job_id UUID NOT NULL REFERENCES project_render_input_snapshots(generation_job_id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    chapter_order_index INTEGER NOT NULL,
    chapter_row_version BIGINT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    media_plan_id UUID NOT NULL REFERENCES media_plans(id),
    media_plan_revision INTEGER NOT NULL CHECK (media_plan_revision > 0),
    global_start_ms BIGINT NOT NULL CHECK (global_start_ms >= 0),
    global_end_ms BIGINT NOT NULL,
    audio_storage_key TEXT NOT NULL,
    audio_size_bytes BIGINT NOT NULL CHECK (audio_size_bytes > 0),
    audio_checksum VARCHAR(128) NOT NULL,
    audio_duration_ms BIGINT NOT NULL CHECK (audio_duration_ms > 0),
    narration_request_id UUID,
    narration_asset_id UUID,
    narration_alignment_id UUID,
    PRIMARY KEY (generation_job_id, chapter_id),
    CONSTRAINT ck_project_render_chapter_range CHECK (global_end_ms > global_start_ms)
);

CREATE INDEX idx_project_render_input_chapters_order
    ON project_render_input_chapters (generation_job_id, chapter_order_index);

CREATE TABLE project_render_input_beats (
    generation_job_id UUID NOT NULL REFERENCES project_render_input_snapshots(generation_job_id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    scene_index INTEGER NOT NULL,
    beat_index INTEGER NOT NULL,
    visual_beat_id UUID NOT NULL,
    media_asset_id UUID NOT NULL REFERENCES media_assets(id),
    global_start_ms BIGINT NOT NULL CHECK (global_start_ms >= 0),
    global_end_ms BIGINT NOT NULL,
    duration_ms BIGINT NOT NULL CHECK (duration_ms > 0),
    camera_movement VARCHAR(32) NOT NULL DEFAULT 'NONE',
    storage_key TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum VARCHAR(128) NOT NULL,
    PRIMARY KEY (generation_job_id, visual_beat_id),
    CONSTRAINT ck_project_render_beat_range CHECK (global_end_ms > global_start_ms)
);

CREATE INDEX idx_project_render_input_beats_order
    ON project_render_input_beats (generation_job_id, global_start_ms, scene_index, beat_index);

CREATE TABLE project_render_artifacts (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    generation_job_id UUID NOT NULL UNIQUE REFERENCES generation_jobs(id),
    render_fingerprint VARCHAR(64) NOT NULL UNIQUE,
    storage_key TEXT NOT NULL,
    storage_provider VARCHAR(32) NOT NULL,
    external_file_id TEXT NOT NULL,
    web_view_link TEXT,
    mime_type VARCHAR(128) NOT NULL DEFAULT 'video/mp4',
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum_sha256 VARCHAR(64) NOT NULL,
    duration_ms BIGINT NOT NULL CHECK (duration_ms > 0),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    fps INTEGER NOT NULL CHECK (fps > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'READY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_project_render_artifact_status CHECK (status IN ('READY', 'ARCHIVED'))
);

CREATE INDEX idx_project_render_artifacts_project_created
    ON project_render_artifacts (project_id, created_at DESC);
