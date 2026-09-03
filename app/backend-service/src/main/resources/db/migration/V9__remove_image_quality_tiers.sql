-- Image generation now has one backend-authoritative provider/model/pricing configuration.
-- These columns represented DRAFT/STANDARD/HIGH selection that no longer changes behavior.

ALTER TABLE projects
    DROP COLUMN IF EXISTS image_quality_tier;

ALTER TABLE visual_beats
    DROP COLUMN IF EXISTS quality_tier_override;

ALTER TABLE media_plans
    DROP COLUMN IF EXISTS image_quality_tier;
