-- NarrativeX final baseline: deterministic bootstrap data only.
-- Keep this file limited to catalog/system seed data. Application/user content
-- must never be embedded in Flyway migrations.

INSERT INTO schema_baseline (id, description)
VALUES ('v1_baseline', 'NarrativeX final three-file baseline')
ON CONFLICT (id) DO NOTHING;

INSERT INTO plan_entitlements (
    id,
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
VALUES
    (1, 'NORMAL', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, 2.000000, CURRENT_TIMESTAMP),
    (2, 'STANDARD', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, 2.000000, CURRENT_TIMESTAMP),
    (3, 'PRO', 1, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true,"narration":true}'::jsonb, 10.000000, CURRENT_TIMESTAMP),
    (4, 'STANDARD', 2, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true}'::jsonb, 10.000000, CURRENT_TIMESTAMP),
    (5, 'STANDARD', 3, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, 50.000000, CURRENT_TIMESTAMP),
    (6, 'PRO', 2, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, 50.000000, CURRENT_TIMESTAMP),
    (7, 'PRO', 3, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, 100.000000, CURRENT_TIMESTAMP),
    (8, 'PRO', 4, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, 100.000000, CURRENT_TIMESTAMP),
    (9, 'PRO', 5, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP),
    (10, 'PRO', 6, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP),
    (11, 'ULTRA', 1, FALSE, 'ULTRA', NULL, NULL, 20, '{"storyAnalysis":true,"shorts":true,"narration":true,"batchReview":true,"team":true,"priority":true,"payAsYouGo":true}'::jsonb, NULL, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    'plan_entitlements_id_seq',
    COALESCE((SELECT MAX(id) FROM plan_entitlements), 1),
    true
);

INSERT INTO style_presets (
    id,
    name,
    category,
    description,
    thumbnail_url,
    prompt_suffix,
    negative_prompt,
    tags_json,
    config_json
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
    id,
    provider,
    name,
    language,
    gender,
    sample_url,
    metadata_json
)
VALUES
    ('vieneu-ngoc-huyen-v2', 'VIENEU', 'Ngọc Huyền v2', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav', '{"style":"natural","local":true,"sdkVoiceName":"Ngọc Huyền v2","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-minh-duc', 'VIENEU', 'Minh Đức', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-minh-duc.wav', '{"style":"natural","local":true,"sdkVoiceName":"Minh Đức","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-truc-ly', 'VIENEU', 'Trúc Ly', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-truc-ly.wav', '{"style":"gentle","local":true,"sdkVoiceName":"Trúc Ly","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-mai-anh', 'VIENEU', 'Mai Anh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-mai-anh.wav', '{"style":"expressive","local":true,"sdkVoiceName":"Mai Anh","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-quynh-anh', 'VIENEU', 'Quỳnh Anh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-quynh-anh.wav', '{"style":"clear","local":true,"sdkVoiceName":"Quỳnh Anh","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-doan-trang', 'VIENEU', 'Đoan Trang', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-doan-trang.wav', '{"style":"warm","local":true,"sdkVoiceName":"Đoan Trang","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-pham-tuyen', 'VIENEU', 'Phạm Tuyên', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-pham-tuyen.wav', '{"style":"formal","local":true,"sdkVoiceName":"Phạm Tuyên","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-quang-son', 'VIENEU', 'Quang Sơn', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-quang-son.wav', '{"style":"narrative","local":true,"sdkVoiceName":"Quang Sơn","region":"Trung","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-ngoc-tran', 'VIENEU', 'Ngọc Trân', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-tran.wav', '{"style":"melodic","local":true,"sdkVoiceName":"Ngọc Trân","region":"Trung","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-adam', 'VIENEU', 'Adam', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-adam.wav', '{"style":"standard","local":true,"sdkVoiceName":"Adam","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-xuan-vinh', 'VIENEU', 'Xuân Vĩnh', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-xuan-vinh.wav', '{"style":"deep","local":true,"sdkVoiceName":"Xuân Vĩnh","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thai-son', 'VIENEU', 'Thái Sơn', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thai-son.wav', '{"style":"energetic","local":true,"sdkVoiceName":"Thái Sơn","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thuy-dung', 'VIENEU', 'Thùy Dung', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thuy-dung.wav', '{"style":"soft","local":true,"sdkVoiceName":"Thùy Dung","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-my-duyen', 'VIENEU', 'Mỹ Duyên', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-my-duyen.wav', '{"style":"bright","local":true,"sdkVoiceName":"Mỹ Duyên","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-minh-triet', 'VIENEU', 'Minh Triết', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-minh-triet.wav', '{"style":"confident","local":true,"sdkVoiceName":"Minh Triết","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-duc-tri', 'VIENEU', 'Đức Trí', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-duc-tri.wav', '{"style":"mature","local":true,"sdkVoiceName":"Đức Trí","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thuc-doan', 'VIENEU', 'Thục Đoan', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thuc-doan.wav', '{"style":"friendly","local":true,"sdkVoiceName":"Thục Đoan","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-ngoc-huyen', 'VIENEU', 'Ngọc Huyền', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-huyen.wav', '{"style":"natural","local":true,"voiceSource":"PRESET","sdkVoiceName":"Ngọc Huyền","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-thanh-binh', 'VIENEU', 'Thanh Bình', 'vi-VN', 'MALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-thanh-binh.wav', '{"style":"storytelling","local":true,"voiceSource":"PRESET","sdkVoiceName":"Thanh Bình","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-ngoc-linh', 'VIENEU', 'Ngọc Linh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-ngoc-linh.wav', '{"style":"storytelling","local":true,"voiceSource":"PRESET","sdkVoiceName":"Ngọc Linh","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb),
    ('vieneu-kim-thanh', 'VIENEU', 'Kim Thanh', 'vi-VN', 'FEMALE', 'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-kim-thanh.wav', '{"style":"audiobook","local":true,"voiceSource":"PRESET","sdkVoiceName":"Kim Thanh","region":"Nam","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider,
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    gender = EXCLUDED.gender,
    sample_url = EXCLUDED.sample_url,
    metadata_json = EXCLUDED.metadata_json,
    enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- This is intentionally harmless on a clean database and also gives an explicit
-- default plan if auth users are pre-provisioned before V3 is applied.
INSERT INTO user_plan_assignments (
    user_id,
    plan_key,
    entitlement_version,
    status,
    period_start,
    period_end
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
