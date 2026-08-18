-- Persist the canonical Scene lifecycle defined by NarrativeX V1.8.
ALTER TABLE scenes
    ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'DRAFT';
