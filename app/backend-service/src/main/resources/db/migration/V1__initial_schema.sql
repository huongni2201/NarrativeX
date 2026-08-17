-- NarrativeX Initial Schema Migration Baseline
-- Business domain tables (Story, Generation, Media, Billing, etc.) will be introduced in subsequent domain modules.

CREATE TABLE IF NOT EXISTS schema_baseline (
    id VARCHAR(64) PRIMARY KEY,
    initialized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_baseline (id, description)
VALUES ('v1_baseline', 'NarrativeX initial schema baseline')
ON CONFLICT (id) DO NOTHING;
