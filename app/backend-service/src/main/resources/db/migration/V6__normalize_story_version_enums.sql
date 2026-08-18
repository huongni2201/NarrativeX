-- Normalize legacy StoryVersion enum values written by the demo seed before the
-- Java domain lifecycle was simplified. Do not edit V2: it may already be
-- recorded in flyway_schema_history on existing environments.

UPDATE story_versions
SET moderation_decision = 'SAFE'
WHERE moderation_decision = 'ALLOW';

-- READY represented the selected/usable story in the legacy seed. It maps to
-- the current ACTIVE lifecycle state. ARCHIVED is now owned by Project, so an
-- archived StoryVersion is retained as SUPERSEDED history.
UPDATE story_versions
SET status = 'ACTIVE'
WHERE status = 'READY';

UPDATE story_versions
SET status = 'SUPERSEDED'
WHERE status = 'ARCHIVED';

ALTER TABLE story_versions
    DROP CONSTRAINT IF EXISTS ck_story_versions_status;

ALTER TABLE story_versions
    ADD CONSTRAINT ck_story_versions_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'BLOCKED')) NOT VALID;

ALTER TABLE story_versions
    VALIDATE CONSTRAINT ck_story_versions_status;

ALTER TABLE story_versions
    DROP CONSTRAINT IF EXISTS ck_story_versions_moderation_decision;

ALTER TABLE story_versions
    ADD CONSTRAINT ck_story_versions_moderation_decision
    CHECK (moderation_decision IN ('PENDING', 'SAFE', 'REVIEW', 'BLOCK')) NOT VALID;

ALTER TABLE story_versions
    VALIDATE CONSTRAINT ck_story_versions_moderation_decision;
