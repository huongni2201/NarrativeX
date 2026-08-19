-- Support the Chapter storyboard review screen with user-facing beat titles and review state.
ALTER TABLE visual_beats
    ADD COLUMN title VARCHAR(200);

UPDATE visual_beats
SET title = COALESCE(
    NULLIF(
        LEFT(
            regexp_replace(btrim(visual_intent), E'\\s+', ' ', 'g'),
            200
        ),
        ''
    ),
    'Visual beat'
);

ALTER TABLE visual_beats
    ALTER COLUMN title SET NOT NULL,
    ADD COLUMN review_status VARCHAR(24) NOT NULL DEFAULT 'NEEDS_REVIEW';

ALTER TABLE visual_beats
    ADD CONSTRAINT ck_visual_beats_review_status
        CHECK (review_status IN ('NEEDS_REVIEW', 'APPROVED'));

CREATE INDEX idx_visual_beats_scene_review_order
    ON visual_beats (scene_id, review_status, order_index, id);
