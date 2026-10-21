-- Add optimistic selection writes and a human review snapshot to the current Shot edit.
-- V17 follows both the current V1-V7 baseline and historical V8-V16 installations.

ALTER TABLE selected_takes
    ADD COLUMN row_version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN review_fingerprint VARCHAR(64),
    ADD COLUMN review_checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD CONSTRAINT ck_selected_takes_row_version CHECK (row_version >= 0),
    ADD CONSTRAINT ck_selected_takes_review_object
        CHECK (jsonb_typeof(review_checklist_json) = 'object'),
    ADD CONSTRAINT ck_selected_takes_review_fingerprint
        CHECK (review_fingerprint IS NULL OR review_fingerprint ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT ck_selected_takes_review_pair
        CHECK ((review_fingerprint IS NULL AND reviewed_at IS NULL)
            OR (review_fingerprint IS NOT NULL AND reviewed_at IS NOT NULL));
