-- Shorts are derived only from a completed edited/rendered video artifact.
-- No pre-edit media, image generation, narration source, intermediate render, crop, or aspect-ratio
-- conversion may be used. The worker preserves the source final video's geometry.

CREATE TABLE short_clip_requests (
    id UUID PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id BIGINT REFERENCES chapters(id) ON DELETE SET NULL,
    source_final_artifact_id BIGINT NOT NULL REFERENCES final_artifacts(id),
    generation_job_id BIGINT NOT NULL UNIQUE REFERENCES generation_jobs(id) ON DELETE CASCADE,
    start_ms BIGINT NOT NULL,
    end_ms BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    output_final_artifact_id BIGINT REFERENCES final_artifacts(id),
    request_fingerprint VARCHAR(64) NOT NULL UNIQUE,
    worker_id VARCHAR(160),
    heartbeat_at TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(80),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_short_clip_range CHECK (start_ms >= 0 AND end_ms > start_ms),
    CONSTRAINT ck_short_clip_status CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_short_clip_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_short_clip_output_state CHECK (
        (status = 'COMPLETED' AND output_final_artifact_id IS NOT NULL)
        OR (status <> 'COMPLETED' AND output_final_artifact_id IS NULL)
    )
);

CREATE INDEX idx_short_clip_requests_claimable
    ON short_clip_requests (status, created_at, id)
    WHERE status IN ('QUEUED', 'RUNNING');
CREATE INDEX idx_short_clip_requests_source
    ON short_clip_requests (source_final_artifact_id, created_at DESC);

COMMENT ON TABLE short_clip_requests IS
    'Durable short-video queue. source_final_artifact_id must reference a READY CHAPTER_VIDEO or PROJECT_VIDEO; worker trims the final video timeline and preserves its source width, height and aspect ratio.';
