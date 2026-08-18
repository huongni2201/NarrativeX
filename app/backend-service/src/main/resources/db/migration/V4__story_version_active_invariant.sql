-- Enforce the Project aggregate invariant at the authoritative PostgreSQL boundary.
-- This migration intentionally fails if historical data already contains more than one
-- ACTIVE StoryVersion for a Project; operators must reconcile that data explicitly rather
-- than silently choosing a winner during migration.

DO $$
DECLARE
    duplicate_project_id BIGINT;
BEGIN
    SELECT project_id
      INTO duplicate_project_id
      FROM story_versions
     WHERE status = 'ACTIVE'
     GROUP BY project_id
    HAVING COUNT(*) > 1
     LIMIT 1;

    IF duplicate_project_id IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot enforce one ACTIVE StoryVersion per Project: project_id % has duplicate ACTIVE versions',
            duplicate_project_id;
    END IF;
END $$;

CREATE UNIQUE INDEX uq_story_versions_one_active_per_project
    ON story_versions (project_id)
    WHERE status = 'ACTIVE';
