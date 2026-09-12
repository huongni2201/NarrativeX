-- NarrativeX pre-release baseline: database functions, immutability guards,
-- capacity/export settlement, notifications, and generation events.

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

CREATE OR REPLACE FUNCTION reject_continuity_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new continuity revision instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_continuity_plans_immutable
BEFORE UPDATE OR DELETE ON chapter_continuity_plans
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE TRIGGER trg_scene_continuity_states_immutable
BEFORE UPDATE OR DELETE ON scene_continuity_states
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE TRIGGER trg_visual_beat_continuity_states_immutable
BEFORE UPDATE OR DELETE ON visual_beat_continuity_states
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE TRIGGER trg_continuity_reports_immutable
BEFORE UPDATE OR DELETE ON continuity_reports
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE OR REPLACE FUNCTION guard_completed_analysis_checkpoint()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'COMPLETED' THEN
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.result_json IS DISTINCT FROM OLD.result_json
           OR NEW.result_hash IS DISTINCT FROM OLD.result_hash
           OR NEW.provider_operation_id IS DISTINCT FROM OLD.provider_operation_id THEN
            RAISE EXCEPTION 'completed analysis checkpoint result is immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analysis_checkpoint_terminal_immutable
BEFORE UPDATE ON analysis_checkpoints
FOR EACH ROW EXECUTE FUNCTION guard_completed_analysis_checkpoint();

CREATE OR REPLACE FUNCTION reject_regeneration_plan_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'regeneration_plans is immutable; create a new plan instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_regeneration_plans_immutable
BEFORE UPDATE OR DELETE ON regeneration_plans
FOR EACH ROW EXECUTE FUNCTION reject_regeneration_plan_mutation();

CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
        WITH consumed AS (
            UPDATE quota_reservations
               SET status = 'CONSUMED',
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = NEW.id
               AND status = 'RESERVED'
             RETURNING user_id, period_key, quota_kind, units
        ), settled AS (
            SELECT user_id,
                   period_key,
                   SUM(CASE WHEN quota_kind = 'LONGFORM_EXPORT' THEN units ELSE 0 END)::integer
                       AS longform_units
              FROM consumed
             GROUP BY user_id, period_key
        )
        UPDATE usage_windows uw
           SET longform_exports = uw.longform_exports + settled.longform_units,
               row_version = uw.row_version + 1
          FROM settled
         WHERE uw.user_id = settled.user_id
           AND uw.period_key = settled.period_key;
    ELSIF NEW.status IN ('FAILED', 'CANCELED')
          AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE quota_reservations
           SET status = 'RELEASED',
               finalized_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP,
               row_version = row_version + 1
         WHERE generation_job_id = NEW.id
           AND status = 'RESERVED';
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
