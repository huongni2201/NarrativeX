-- NarrativeX pre-release baseline: deterministic catalog/system bootstrap only.
-- Application/user content must never be embedded in Flyway migrations.

INSERT INTO plan_entitlements (
    id, plan_key, version, watermark_required, max_video_quality,
    max_longform_exports_month, max_short_exports_month,
    max_concurrent_expensive_jobs, feature_flags_json, active_from
)
VALUES
    (1, 'NORMAL', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, CURRENT_TIMESTAMP),
    (3, 'PRO', 1, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true,"narration":true}'::jsonb, CURRENT_TIMESTAMP),
    (6, 'PRO', 2, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, CURRENT_TIMESTAMP),
    (7, 'PRO', 3, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, CURRENT_TIMESTAMP),
    (8, 'PRO', 4, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, CURRENT_TIMESTAMP),
    (9, 'PRO', 5, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, CURRENT_TIMESTAMP),
    (10, 'PRO', 6, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, CURRENT_TIMESTAMP),
    (11, 'ULTRA', 1, FALSE, 'ULTRA', NULL, NULL, 20, '{"storyAnalysis":true,"shorts":true,"narration":true,"batchReview":true,"team":true,"priority":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    'plan_entitlements_id_seq',
    COALESCE((SELECT MAX(id) FROM plan_entitlements), 1),
    true
);

INSERT INTO style_presets (
    id, name, category, description, thumbnail_url, prompt_suffix,
    negative_prompt, tags_json, config_json
)
VALUES
    (
        1,
        'Cinematic Warmth',
        'VISUAL_STYLE',
        'Warm cinematic lighting with grounded texture.',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
        'cinematic composition, warm practical light, subtle film grain',
        'blurry, distorted anatomy, text, watermark',
        '["cinematic", "warm", "story"]'::jsonb,
        '{"defaultAspectRatio":"16:9","defaultQuality":"Standard","lighting":"warm practical","atmosphere":"intimate"}'::jsonb
    ),
    (
        2,
        'Storybook Watercolor',
        'IMAGE',
        'Soft illustrated treatment for intimate story moments.',
        'https://images.unsplash.com/photo-1549490349-8643362247b5',
        'storybook watercolor illustration, soft edges, expressive silhouettes',
        'photorealistic, harsh contrast, text, watermark',
        '["illustration", "watercolor", "soft"]'::jsonb,
        '{"defaultAspectRatio":"16:9","defaultQuality":"Standard","lighting":"diffused","atmosphere":"dreamy"}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    'style_presets_id_seq',
    COALESCE((SELECT MAX(id) FROM style_presets), 1),
    true
);

INSERT INTO voice_catalog (
    id, provider, name, language, gender, sample_url, metadata_json
)
VALUES
    (
        'voicestudio-default',
        'VOICESTUDIO',
        'VoiceStudio Default',
        'vi-VN',
        'NEUTRAL',
        NULL,
        '{"style":"natural","local":true,"profileId":"default","model":"tts-1","supportsSpeakingRate":true,"supportsVoiceClone":true,"supportsBatch":false,"sampleRateHz":48000,"outputFormat":"wav","executionSemantics":"LOCAL_RETRYABLE"}'::jsonb
    )
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider,
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    gender = EXCLUDED.gender,
    sample_url = EXCLUDED.sample_url,
    metadata_json = EXCLUDED.metadata_json,
    enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_plan_assignments (
    user_id, plan_key, entitlement_version, status, period_start, period_end
)
SELECT au.id,
       pe.plan_key,
       pe.version,
       'ACTIVE',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP + INTERVAL '1 month'
  FROM auth_users au
  JOIN plan_entitlements pe
    ON pe.plan_key = 'NORMAL'
   AND pe.version = 1
ON CONFLICT (user_id) DO NOTHING;
