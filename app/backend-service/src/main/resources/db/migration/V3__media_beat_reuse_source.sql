-- Add immutable intra-plan image-reuse lineage to media beat plans.
-- The source points at a visual beat whose generated READY asset may be shared by this beat.

ALTER TABLE media_beat_plans
    ADD COLUMN reuse_source_visual_beat_id UUID;

ALTER TABLE media_beat_plans
    ADD CONSTRAINT ck_media_beat_plans_reuse_source_strategy
        CHECK (
            (asset_strategy IN ('REUSE_APPROVED', 'REFRAME_DERIVED')
                AND reuse_source_visual_beat_id IS NOT NULL)
            OR (asset_strategy NOT IN ('REUSE_APPROVED', 'REFRAME_DERIVED')
                AND reuse_source_visual_beat_id IS NULL)
        ),
    ADD CONSTRAINT ck_media_beat_plans_reuse_source_not_self
        CHECK (reuse_source_visual_beat_id IS NULL OR reuse_source_visual_beat_id <> visual_beat_id);

CREATE INDEX idx_media_beat_plans_reuse_source
    ON media_beat_plans (media_plan_id, reuse_source_visual_beat_id)
    WHERE reuse_source_visual_beat_id IS NOT NULL;
