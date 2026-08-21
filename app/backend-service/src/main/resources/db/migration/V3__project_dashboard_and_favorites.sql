-- Project dashboard query support and per-user favorites.

CREATE TABLE project_favorites (
    user_id VARCHAR(128) NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_favorites PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_project_favorites_project_user
    ON project_favorites (project_id, user_id);

CREATE INDEX idx_projects_owner_status_updated_active
    ON projects (owner_id, status, updated_at DESC, id DESC)
    WHERE archived_at IS NULL;

CREATE INDEX idx_projects_owner_created_active
    ON projects (owner_id, created_at ASC, id ASC)
    WHERE archived_at IS NULL;

CREATE INDEX idx_projects_owner_lower_name_active
    ON projects (owner_id, LOWER(name), id)
    WHERE archived_at IS NULL;

-- Enable efficient case-insensitive contains search on project names.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_projects_lower_name_trgm_active
    ON projects USING gin (LOWER(name) gin_trgm_ops)
    WHERE archived_at IS NULL;
