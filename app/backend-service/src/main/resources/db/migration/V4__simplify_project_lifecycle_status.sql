-- Project.status represents only the durable lifecycle of the Project itself.
-- Transient analysis/generation/render progress belongs to Chapter/GenerationJob state.

UPDATE projects
SET status = 'ACTIVE'
WHERE status IN ('ANALYZING', 'STORYBOARD_READY', 'RENDERING', 'COMPLETED');

ALTER TABLE projects
    ADD CONSTRAINT ck_projects_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')) NOT VALID;

ALTER TABLE projects
    VALIDATE CONSTRAINT ck_projects_status;
