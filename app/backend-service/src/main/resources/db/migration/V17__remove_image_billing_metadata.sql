-- Image generation no longer participates in monetary accounting.
-- Keep generic provider-operation/narration billing tables unchanged.

ALTER TABLE media_plans
    DROP CONSTRAINT IF EXISTS ck_media_plans_pricing_snapshot_object,
    DROP CONSTRAINT IF EXISTS ck_media_plans_pricing_fingerprint,
    DROP COLUMN IF EXISTS estimated_cost,
    DROP COLUMN IF EXISTS pricing_snapshot_json,
    DROP COLUMN IF EXISTS pricing_fingerprint;

ALTER TABLE regeneration_plans
    DROP CONSTRAINT IF EXISTS ck_regeneration_plan_cost_nonnegative,
    DROP CONSTRAINT IF EXISTS ck_regeneration_plan_currency,
    DROP COLUMN IF EXISTS estimated_cost,
    DROP COLUMN IF EXISTS currency;
