-- NarrativeX pre-release baseline: database functions, immutability guards, settlement, notifications, generation events, and final schema normalization.

CREATE OR REPLACE FUNCTION reject_media_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new media plan revision instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_plans_immutable
BEFORE UPDATE ON media_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE TRIGGER trg_media_scene_plans_immutable
BEFORE UPDATE ON media_scene_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE TRIGGER trg_media_beat_plans_immutable
BEFORE UPDATE ON media_beat_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE OR REPLACE FUNCTION reject_media_asset_lineage_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'media_asset_lineage is immutable; insert a new lineage row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_asset_lineage_immutable
BEFORE UPDATE OR DELETE ON media_asset_lineage
FOR EACH ROW EXECUTE FUNCTION reject_media_asset_lineage_update();

CREATE OR REPLACE FUNCTION reject_media_generation_item_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.generation_job_id <> NEW.generation_job_id
       OR OLD.media_plan_id <> NEW.media_plan_id
       OR OLD.visual_beat_id <> NEW.visual_beat_id
       OR OLD.item_key <> NEW.item_key
       OR OLD.attempt_number <> NEW.attempt_number
       OR OLD.request_fingerprint <> NEW.request_fingerprint THEN
        RAISE EXCEPTION 'media_generation_items immutable request identity cannot change';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_generation_items_identity_immutable
BEFORE UPDATE ON media_generation_items
FOR EACH ROW EXECUTE FUNCTION reject_media_generation_item_snapshot_update();

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
        NEW.job_type = 'RENDER_PROJECT'
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
                RAISE EXCEPTION 'Cannot complete generation job % without reconciled provider billing', NEW.id;
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

CREATE TRIGGER trg_generation_jobs_finalize_quota
AFTER UPDATE OF status ON generation_jobs
FOR EACH ROW
WHEN (NEW.status IN ('COMPLETED', 'FAILED', 'CANCELED'))
EXECUTE FUNCTION finalize_quota_reservation_on_job_terminal();

CREATE OR REPLACE FUNCTION create_generation_completion_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    notification_type VARCHAR(48);
    notification_title_key VARCHAR(128);
    notification_message_key VARCHAR(128);
BEGIN
    IF NEW.status = 'COMPLETED'
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.job_type IN ('CHAPTER_GENERATE', 'NARRATION_GENERATE') THEN
        IF NEW.job_type = 'NARRATION_GENERATE' THEN
            notification_type := 'NARRATION_COMPLETED';
            notification_title_key := 'notification.narration.completed';
            notification_message_key := 'notification.narration.completed.desc';
        ELSE
            notification_type := 'IMAGE_GENERATION_COMPLETED';
            notification_title_key := 'notification.image_generation.completed';
            notification_message_key := 'notification.image_generation.completed.desc';
        END IF;

        INSERT INTO notifications (
            user_id,
            project_id,
            event_key,
            type,
            title_key,
            message_key
        ) VALUES (
            NEW.requested_by_user_id,
            NEW.project_id,
            'generation-job:' || NEW.job_id::text || ':completed',
            notification_type,
            notification_title_key,
            notification_message_key
        ) ON CONFLICT (event_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generation_jobs_notify_completion
AFTER UPDATE OF status ON generation_jobs
FOR EACH ROW
WHEN (NEW.status = 'COMPLETED')
EXECUTE FUNCTION create_generation_completion_notification();

CREATE OR REPLACE FUNCTION notify_generation_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_type TEXT;
    target_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IS NOT DISTINCT FROM NEW.status
           AND OLD.progress IS NOT DISTINCT FROM NEW.progress
           AND OLD.current_step IS NOT DISTINCT FROM NEW.current_step
           AND OLD.error_code IS NOT DISTINCT FROM NEW.error_code THEN
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.chapter_id IS NOT NULL THEN
        target_type := 'CHAPTER';
        target_id := NEW.chapter_id;
    ELSIF NEW.story_version_id IS NOT NULL THEN
        target_type := 'STORY_VERSION';
        target_id := NEW.story_version_id;
    ELSE
        target_type := 'PROJECT';
        target_id := NEW.project_id;
    END IF;

    PERFORM pg_notify(
        'narrativex_generation_events',
        json_build_object(
            'eventId', NEW.job_id::text || ':' || NEW.row_version::text,
            'userId', NEW.requested_by_user_id,
            'projectId', NEW.project_id,
            'job', json_build_object(
                'jobId', NEW.job_id,
                'type', NEW.job_type,
                'status', NEW.status,
                'progress', NEW.progress,
                'currentStep', NEW.current_step,
                'entityType', target_type,
                'entityId', target_id,
                'target', json_build_object('type', target_type, 'id', target_id),
                'errorCode', NEW.error_code,
                'mediaPlanId', NEW.media_plan_id,
                'mediaPlanRevision', NEW.media_plan_revision
            )
        )::text
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generation_jobs_sse_events
AFTER INSERT OR UPDATE OF status, progress, current_step, error_code ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_generation_job_change();

COMMENT ON COLUMN project_render_input_snapshots.assigned_local_device_id IS
    'Paired Desktop device assigned to execute this immutable local project render.';

-- -----------------------------------------------------------------------------
-- Device-local project-media hard cut (pre-release baseline finalization)
-- Project media is project-owned/local. Custom account voice references are R2-backed.
-- -----------------------------------------------------------------------------
CREATE TABLE voice_reference_assets (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    detected_content_type VARCHAR(160),
    detected_container VARCHAR(64),
    detected_codec VARCHAR(64),
    validation_error_code VARCHAR(96),
    validation_error_detail VARCHAR(1024),
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_voice_reference_assets_account_checksum UNIQUE (account_id, sha256),
    CONSTRAINT ck_voice_reference_assets_size CHECK (size_bytes > 0),
    CONSTRAINT ck_voice_reference_assets_sha CHECK (char_length(sha256) = 64),
    CONSTRAINT ck_voice_reference_assets_storage_key CHECK (storage_key LIKE 'voices/%'),
    CONSTRAINT ck_voice_reference_assets_status CHECK (
        status IN ('VALIDATING', 'READY', 'REJECTED', 'DELETED')
    )
);

ALTER TABLE media_upload_sessions
    DROP CONSTRAINT IF EXISTS media_upload_sessions_media_asset_id_fkey;
ALTER TABLE media_upload_sessions
    ADD CONSTRAINT media_upload_sessions_media_asset_id_fkey
    FOREIGN KEY (media_asset_id) REFERENCES voice_reference_assets(id) ON DELETE SET NULL;

ALTER TABLE media_validation_jobs
    DROP CONSTRAINT IF EXISTS media_validation_jobs_media_asset_id_fkey;
ALTER TABLE media_validation_jobs
    ADD CONSTRAINT media_validation_jobs_media_asset_id_fkey
    FOREIGN KEY (media_asset_id) REFERENCES voice_reference_assets(id) ON DELETE CASCADE;

ALTER TABLE narration_requests
    ADD COLUMN account_voice_reference_asset_id UUID REFERENCES voice_reference_assets(id),
    ADD CONSTRAINT ck_narration_requests_single_voice_reference
    CHECK (
        project_voice_reference_asset_id IS NULL
        OR account_voice_reference_asset_id IS NULL
    );

DROP TABLE media_asset_checksums;

ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS ck_media_assets_storage_scope;
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS ck_media_assets_storage_mode;
ALTER TABLE media_assets ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE media_assets DROP COLUMN storage_mode;

ALTER TABLE project_render_input_beats
    DROP CONSTRAINT IF EXISTS ck_project_render_input_beats_storage_mode;
ALTER TABLE project_render_input_beats
    DROP COLUMN IF EXISTS storage_mode;

DROP TABLE IF EXISTS local_media_materializations CASCADE;
