-- NarrativeX: Durable Chapter Analysis Run Provenance and Telemetry (ADR-0022)

CREATE TABLE chapter_analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    storyboard_revision_id UUID REFERENCES storyboard_revisions(id) ON DELETE SET NULL,
    source_hash VARCHAR(64) NOT NULL,
    model VARCHAR(128) NOT NULL,
    prompt_version VARCHAR(64) NOT NULL,
    schema_version VARCHAR(64) NOT NULL,
    prompt_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    thinking_tokens BIGINT NOT NULL DEFAULT 0,
    cached_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    runtime_ms BIGINT NOT NULL DEFAULT 0,
    canon_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_chapter_analysis_runs_source_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_chapter_analysis_runs_canon_hash CHECK (canon_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_chapter_analysis_runs_prompt_tokens CHECK (prompt_tokens >= 0),
    CONSTRAINT ck_chapter_analysis_runs_output_tokens CHECK (output_tokens >= 0),
    CONSTRAINT ck_chapter_analysis_runs_thinking_tokens CHECK (thinking_tokens >= 0),
    CONSTRAINT ck_chapter_analysis_runs_cached_tokens CHECK (cached_tokens >= 0),
    CONSTRAINT ck_chapter_analysis_runs_total_tokens CHECK (total_tokens >= 0),
    CONSTRAINT ck_chapter_analysis_runs_runtime_ms CHECK (runtime_ms >= 0)
);

CREATE INDEX idx_chapter_analysis_runs_chapter_created ON chapter_analysis_runs (chapter_id, created_at DESC);
CREATE INDEX idx_chapter_analysis_runs_job ON chapter_analysis_runs (generation_job_id);
CREATE INDEX idx_chapter_analysis_runs_canon_hash ON chapter_analysis_runs (canon_hash);
