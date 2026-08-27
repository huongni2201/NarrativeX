-- Persist the visual workflow preferences chosen when a Chapter analysis job is enqueued.
-- These values belong to the durable generation-job snapshot so the worker and desktop can
-- recover the same intent after process restarts or UI reloads.

ALTER TABLE generation_jobs
    ADD COLUMN analysis_visual_generation_mode VARCHAR(16),
    ADD COLUMN analysis_image_provider VARCHAR(32);

ALTER TABLE generation_jobs
    ADD CONSTRAINT ck_generation_jobs_analysis_visual_mode
        CHECK (
            analysis_visual_generation_mode IS NULL
            OR analysis_visual_generation_mode IN ('IMAGE', 'VIDEO')
        ),
    ADD CONSTRAINT ck_generation_jobs_analysis_image_provider
        CHECK (
            analysis_image_provider IS NULL
            OR analysis_image_provider IN ('GEMINI_WEB', 'API')
        ),
    ADD CONSTRAINT ck_generation_jobs_analysis_preferences_consistent
        CHECK (
            analysis_visual_generation_mode IS NULL
            OR (analysis_visual_generation_mode = 'IMAGE'
                AND analysis_image_provider IN ('GEMINI_WEB', 'API'))
            OR (analysis_visual_generation_mode = 'VIDEO'
                AND analysis_image_provider IS NULL)
        );
