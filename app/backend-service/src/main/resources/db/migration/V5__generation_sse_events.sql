-- PostgreSQL remains authoritative; NOTIFY is only a best-effort realtime delivery hint.
CREATE OR REPLACE FUNCTION notify_generation_job_change()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_generation_jobs_sse_events ON generation_jobs;
CREATE TRIGGER trg_generation_jobs_sse_events
AFTER INSERT OR UPDATE OF status, progress, current_step, error_code ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_generation_job_change();
