ALTER TABLE final_artifacts
    ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32) NOT NULL DEFAULT 'R2',
    ADD COLUMN IF NOT EXISTS external_file_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS web_view_link TEXT;

UPDATE final_artifacts
   SET storage_provider = 'R2'
 WHERE storage_provider IS NULL OR BTRIM(storage_provider) = '';

CREATE INDEX IF NOT EXISTS idx_final_artifacts_external_file_id
    ON final_artifacts (storage_provider, external_file_id)
    WHERE external_file_id IS NOT NULL;
