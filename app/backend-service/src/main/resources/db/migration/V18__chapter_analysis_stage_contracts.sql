-- Freeze the versioned CANON/STORY contracts alongside the legacy Chapter Analysis snapshot fields.
-- V18 is additive so installations that already applied V4 or V17 keep their migration checksums.

ALTER TABLE chapter_analysis_execution_snapshots
    ADD COLUMN stage_contracts_json JSONB,
    ADD CONSTRAINT ck_chapter_analysis_stage_contracts_object
        CHECK (stage_contracts_json IS NULL OR jsonb_typeof(stage_contracts_json) = 'object');
