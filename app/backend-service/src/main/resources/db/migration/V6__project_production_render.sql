-- Project-level immutable render snapshots for long-form production timelines.
-- Chapter render tables remain unchanged; this slice adds a separate project render boundary.
-- Final project video outputs use the canonical final_artifacts table as PROJECT_VIDEO.

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
    render_profile_json JSONB NOT NULL DEFAULT '{
      "schemaVersion": 1,
      "engine": "ffmpeg-python",
      "rendererVersion": "project-image-motion-v2-frame-quantized",
      "fps": 30,
      "video": {
        "encoder": "libx264",
        "x264Preset": "veryfast",
        "crf": 20,
        "nvencPreset": "p5",
        "nvencCq": 21,
        "pixelFormat": "yuv420p"
      },
      "audio": {
        "codec": "aac",
        "bitrate": "192k",
        "sampleRate": 48000
      },
      "effects": {
        "transition": "LEGACY_FADE",
        "transitionSeconds": 0.12,
        "colorGrade": "NONE",
        "backgroundMode": "COVER",
        "backgroundBlurSigma": 22.0,
        "overlayStyle": "NONE",
        "overlayOpacity": 0.30,
        "watermarkWidthRatio": 0.12,
        "watermarkOpacity": 0.82,
        "watermarkPosition": "TOP_RIGHT",
        "bgmVolume": 0.18,
        "duckThreshold": 0.08,
        "duckRatio": 8.0,
        "duckAttackMs": 20.0,
        "duckReleaseMs": 350.0,
        "motionEasing": "LINEAR",
        "textOverlays": [],
        "lutAsset": null,
        "overlayAsset": null,
        "watermarkAsset": null,
        "bgmAsset": null
      },
      "subtitles": {
        "mode": "none"
      }
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_project_render_input_resolution CHECK (resolution IN ('720p', '1080p')),
    CONSTRAINT ck_project_render_input_format CHECK (render_format = 'mp4'),
    CONSTRAINT ck_project_render_profile_object CHECK (jsonb_typeof(render_profile_json) = 'object'),
    CONSTRAINT ck_project_render_profile_version CHECK ((render_profile_json ->> 'schemaVersion')::integer = 1)
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

-- final_artifacts is the canonical durable output model for chapter, project, and short videos.
-- Keep one active PROJECT_VIDEO artifact per render job while allowing multiple intentional
-- rerenders of the same immutable render fingerprint to reference the same storage object.
CREATE UNIQUE INDEX uq_final_artifacts_project_render_job
    ON final_artifacts (generation_job_id)
    WHERE artifact_type = 'PROJECT_VIDEO'
      AND generation_job_id IS NOT NULL
      AND status <> 'ARCHIVED';

CREATE INDEX idx_final_artifacts_project_video_fingerprint
    ON final_artifacts (project_id, render_fingerprint)
    WHERE artifact_type = 'PROJECT_VIDEO';

-- RENDER_PROJECT is a local CPU render just like CHAPTER_RENDER. Re-declare the
-- terminal quota trigger function so project renders consume their reserved credit
-- without requiring a provider_operations billing row.
CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    reconciled_cost NUMERIC(19, 9);
    reconciled_currency VARCHAR(3);
    billed_operation_count INTEGER;
    local_zero_cost_narration BOOLEAN := FALSE;
    local_credit_render BOOLEAN := FALSE;
BEGIN
    SELECT COALESCE(SUM(po.actual_cost), 0),
           CASE
               WHEN COUNT(DISTINCT po.billing_currency)
                    FILTER (WHERE po.actual_cost IS NOT NULL) = 1
                   THEN MAX(po.billing_currency) FILTER (WHERE po.actual_cost IS NOT NULL)
               ELSE NULL
           END,
           COUNT(*) FILTER (WHERE po.actual_cost IS NOT NULL)
      INTO reconciled_cost, reconciled_currency, billed_operation_count
      FROM provider_operations po
      JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
     WHERE sa.generation_job_id = NEW.id;

    IF NEW.job_type = 'NARRATION_GENERATE' THEN
        SELECT EXISTS (
            SELECT 1
              FROM narration_operations no
              JOIN narration_requests nr ON nr.id = no.narration_request_id
              LEFT JOIN voice_catalog vc ON vc.id = nr.voice_id
             WHERE no.generation_job_id = NEW.id
               AND (
                   UPPER(COALESCE(vc.provider, '')) = 'VIENEU'
                   OR COALESCE(vc.metadata_json ->> 'executionSemantics', '') = 'LOCAL_RETRYABLE'
                   OR nr.voice_id LIKE 'vieneu-%'
               )
        ) INTO local_zero_cost_narration;
    END IF;

    local_credit_render :=
        NEW.job_type IN ('CHAPTER_RENDER', 'RENDER_PROJECT')
        AND NEW.resource_class = 'CPU_RENDER';

    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
        IF local_zero_cost_narration AND billed_operation_count = 0 THEN
            UPDATE quota_reservations
               SET status = 'CONSUMED',
                   actual_cost = 0,
                   billing_currency = 'USD',
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED';
        ELSIF local_credit_render AND billed_operation_count = 0 THEN
            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = estimated_cost,
                       billing_currency = 'USD',
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        ELSE
            IF billed_operation_count = 0 OR reconciled_currency IS NULL THEN
                RAISE EXCEPTION
                    'Cannot complete generation job % without reconciled provider billing', NEW.id;
            END IF;

            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = reconciled_cost,
                       billing_currency = reconciled_currency,
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        END IF;
    ELSIF NEW.status IN ('FAILED', 'CANCELED')
          AND OLD.status IS DISTINCT FROM NEW.status THEN
        IF billed_operation_count > 0
           AND reconciled_currency IS NOT NULL
           AND reconciled_cost > 0 THEN
            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       actual_cost = reconciled_cost,
                       billing_currency = reconciled_currency,
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = NEW.id
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, actual_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.actual_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key;
        ELSE
            UPDATE quota_reservations
               SET status = 'RELEASED',
                   actual_cost = 0,
                   billing_currency = COALESCE(reconciled_currency, 'USD'),
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;