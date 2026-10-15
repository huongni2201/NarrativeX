-- NarrativeX pre-release baseline: database functions, immutability guards, and generation events.

CREATE OR REPLACE FUNCTION reject_media_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new media plan revision instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_plans_immutable
BEFORE UPDATE ON media_plans
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

CREATE TRIGGER trg_generation_jobs_events
AFTER INSERT OR UPDATE ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_generation_job_change();

-- Frozen take admission metadata survives result/status updates.
CREATE FUNCTION protect_take_inputs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.generation_job_id, OLD.compute_task_id, OLD.compute_attempt_id, OLD.operation_plan_id,
      OLD.input_snapshot_json, OLD.input_fingerprint, OLD.shot_id, OLD.attempt_number, OLD.provider, OLD.model, OLD.generation_mode)
    IS DISTINCT FROM
     (NEW.generation_job_id, NEW.compute_task_id, NEW.compute_attempt_id, NEW.operation_plan_id,
      NEW.input_snapshot_json, NEW.input_fingerprint, NEW.shot_id, NEW.attempt_number, NEW.provider, NEW.model, NEW.generation_mode) THEN
    RAISE EXCEPTION 'Take admission inputs are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER takes_frozen_inputs BEFORE UPDATE ON takes
  FOR EACH ROW EXECUTE FUNCTION protect_take_inputs();

-- Chapter analysis execution snapshots are immutable once admitted.
CREATE FUNCTION reject_chapter_analysis_snapshot_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'chapter analysis execution snapshots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_analysis_execution_snapshots_immutable
    BEFORE UPDATE ON chapter_analysis_execution_snapshots
    FOR EACH ROW EXECUTE FUNCTION reject_chapter_analysis_snapshot_mutation();

-- Frozen Chapter Analysis prompt snapshots are immutable once admitted.
CREATE FUNCTION reject_chapter_analysis_prompt_snapshot_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'chapter analysis prompt snapshots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_analysis_prompt_snapshots_immutable
    BEFORE UPDATE ON chapter_analysis_prompt_snapshots
    FOR EACH ROW EXECUTE FUNCTION reject_chapter_analysis_prompt_snapshot_mutation();
