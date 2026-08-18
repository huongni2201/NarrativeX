-- Matches the keyset pagination query used by ProjectPersistenceAdapter.
CREATE INDEX IF NOT EXISTS idx_projects_active_owner_updated_id
    ON projects (owner_id, updated_at DESC, id DESC)
    WHERE archived_at IS NULL;
