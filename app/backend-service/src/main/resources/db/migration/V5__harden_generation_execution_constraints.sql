-- Canonical persisted execution contract.
--
-- V2 contains development-only legacy values. They are migrated explicitly
-- below before the checks are installed. Values outside the known contract
-- are not rewritten and cause this migration to fail.

UPDATE generation_jobs
   SET job_type = CASE job_type
       WHEN 'ANALYZE_STORY' THEN 'STORY_ANALYZE'
       WHEN 'STORY_ANALYSIS' THEN 'STORY_ANALYZE'
       WHEN 'ANALYZE_CHAPTER' THEN 'CHAPTER_ANALYZE'
       WHEN 'GENERATE_CHAPTER' THEN 'CHAPTER_GENERATE'
       WHEN 'RENDER_CHAPTER' THEN 'CHAPTER_RENDER'
       WHEN 'CONTINUE_PROJECT' THEN 'PROJECT_CONTINUE'
       WHEN 'GENERATE_IMAGE' THEN 'IMAGE_GENERATE'
       WHEN 'IMAGE_GENERATION' THEN 'IMAGE_GENERATE'
       WHEN 'GENERATE_SHORT' THEN 'RENDER_SHORT'
       WHEN 'VIDEO_RENDER' THEN 'RENDER_PROJECT'
       WHEN 'SHORT_EXPORT' THEN 'RENDER_SHORT'
       ELSE job_type
   END,
       resource_class = CASE resource_class
       WHEN 'STANDARD' THEN 'CPU_LIGHT'
       WHEN 'GPU' THEN 'GPU_HEAVY'
       ELSE resource_class
   END,
       status = CASE status
       WHEN 'PENDING' THEN 'QUEUED'
       WHEN 'SUCCEEDED' THEN 'COMPLETED'
       ELSE status
   END;

UPDATE stage_attempts
   SET status = CASE status
       WHEN 'PENDING' THEN 'QUEUED'
       WHEN 'SUCCEEDED' THEN 'COMPLETED'
       ELSE status
   END;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM generation_jobs
         WHERE progress < 0 OR progress > 100
    ) THEN
        RAISE EXCEPTION
            'V5 refused to clamp generation_jobs.progress outside [0,100]';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM generation_jobs
         WHERE status NOT IN (
             'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
             'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
         )
    ) THEN
        RAISE EXCEPTION 'V5 found an unknown generation_jobs.status value';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM generation_jobs
         WHERE job_type NOT IN (
             'STORY_ANALYZE', 'CHAPTER_ANALYZE', 'IMAGE_GENERATE',
             'CHAPTER_GENERATE', 'CHAPTER_RENDER', 'PROJECT_CONTINUE',
             'VISUAL_BEAT_PLAN', 'SHOT_IMAGE_GENERATE', 'RENDER_PROJECT',
             'RENDER_SHORT'
         )
    ) THEN
        RAISE EXCEPTION 'V5 found an unknown generation_jobs.job_type value';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM generation_jobs
         WHERE resource_class NOT IN (
             'PROVIDER_INTERACTIVE', 'PROVIDER_BATCH', 'GPU_HEAVY',
             'CPU_RENDER', 'CPU_LIGHT', 'BACKGROUND', 'NOTIFICATION',
             'FAST_CPU', 'CPU_HEAVY', 'MEDIA_IO'
         )
    ) THEN
        RAISE EXCEPTION
            'V5 found an unknown generation_jobs.resource_class value';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM stage_attempts
         WHERE status NOT IN (
             'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
             'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
         )
    ) THEN
        RAISE EXCEPTION 'V5 found an unknown stage_attempts.status value';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM provider_operations
         WHERE status NOT IN (
             'RESERVED', 'SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED',
             'UNKNOWN'
         )
    ) THEN
        RAISE EXCEPTION 'V5 found an unknown provider_operations.status value';
    END IF;
END $$;

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_progress
    CHECK (progress BETWEEN 0 AND 100);

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_status
    CHECK (status IN (
        'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
    ));

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_job_type
    CHECK (job_type IN (
        'STORY_ANALYZE', 'CHAPTER_ANALYZE', 'IMAGE_GENERATE',
        'CHAPTER_GENERATE', 'CHAPTER_RENDER', 'PROJECT_CONTINUE',
        'VISUAL_BEAT_PLAN', 'SHOT_IMAGE_GENERATE', 'RENDER_PROJECT',
        'RENDER_SHORT'
    ));

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_resource_class
    CHECK (resource_class IN (
        'PROVIDER_INTERACTIVE', 'PROVIDER_BATCH', 'GPU_HEAVY',
        'CPU_RENDER', 'CPU_LIGHT', 'BACKGROUND', 'NOTIFICATION',
        'FAST_CPU', 'CPU_HEAVY', 'MEDIA_IO'
    ));

ALTER TABLE stage_attempts
    ADD CONSTRAINT ck_stage_attempts_status
    CHECK (status IN (
        'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED',
        'UNKNOWN', 'STALLED', 'PAUSED_COST_LIMIT'
    ));

-- provider_operations.status is already constrained by V4. Keep that
-- constraint in V4 so existing databases do not receive a duplicate name.
