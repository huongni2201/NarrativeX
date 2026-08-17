-- Supports stable project keyset pagination by owner and most-recent update.
CREATE INDEX idx_projects_owner_updated_id
    ON projects (owner_id, updated_at DESC, id DESC);
