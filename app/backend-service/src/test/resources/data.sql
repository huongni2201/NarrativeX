INSERT INTO plan_entitlements (
    plan_key,
    version,
    watermark_required,
    max_video_quality,
    max_longform_exports_month,
    max_short_exports_month,
    max_concurrent_expensive_jobs,
    feature_flags_json,
    monthly_credits,
    active_from
)
VALUES (
    'NORMAL',
    1,
    TRUE,
    'STANDARD',
    2,
    5,
    1,
    '{"storyAnalysis":true}',
    2.000000,
    CURRENT_TIMESTAMP
), (
    'ULTRA',
    1,
    FALSE,
    'ULTRA',
    NULL,
    NULL,
    20,
    '{"storyAnalysis":true,"shorts":true,"narration":true,"batchReview":true,"team":true,"priority":true,"payAsYouGo":true}',
    NULL,
    CURRENT_TIMESTAMP
);
