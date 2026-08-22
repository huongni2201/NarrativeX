-- Essential system bootstrap dataset for production and local runtime.
-- Only seeds system catalogs and plan entitlements required for system operation.

-- -----------------------------------------------------------------------------
-- Plan entitlements
-- -----------------------------------------------------------------------------

INSERT INTO plan_entitlements (id, plan_key, version, watermark_required, max_video_quality, max_longform_exports_month, max_short_exports_month, max_concurrent_expensive_jobs, feature_flags_json, monthly_credits, active_from)
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
    (10, 'PRO', 6, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

SELECT setval('plan_entitlements_id_seq', COALESCE((SELECT MAX(id) FROM plan_entitlements), 1), true);

-- -----------------------------------------------------------------------------
-- Style presets
-- -----------------------------------------------------------------------------

INSERT INTO style_presets
    (id, name, category, description, thumbnail_url, prompt_suffix, negative_prompt, tags_json, config_json)
VALUES
    (1, 'Cinematic Warmth', 'VISUAL_STYLE', 'Warm cinematic lighting with grounded texture.',
     'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
     'cinematic composition, warm practical light, subtle film grain',
     'blurry, distorted anatomy, text, watermark',
     '["cinematic", "warm", "story"]'::jsonb,
     '{"defaultAspectRatio":"16:9","defaultQuality":"Standard","lighting":"warm practical","atmosphere":"intimate"}'::jsonb),
    (2, 'Storybook Watercolor', 'IMAGE', 'Soft illustrated treatment for intimate story moments.',
     'https://images.unsplash.com/photo-1549490349-8643362247b5',
     'storybook watercolor illustration, soft edges, expressive silhouettes',
     'photorealistic, harsh contrast, text, watermark',
     '["illustration", "watercolor", "soft"]'::jsonb,
     '{"defaultAspectRatio":"16:9","defaultQuality":"Standard","lighting":"diffused","atmosphere":"dreamy"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT setval('style_presets_id_seq', COALESCE((SELECT MAX(id) FROM style_presets), 1), true);

-- -----------------------------------------------------------------------------
-- Voice catalog
-- -----------------------------------------------------------------------------

INSERT INTO voice_catalog (id, provider, name, language, gender, sample_url, metadata_json)
VALUES
    ('narrativex-en-us-female-1', 'NARRATIVEX', 'Clara', 'en-US', 'FEMALE', NULL, '{"style":"warm"}'::jsonb),
    ('narrativex-vi-vn-female-1', 'NARRATIVEX', 'Mai', 'vi-VN', 'FEMALE', NULL, '{"style":"natural"}'::jsonb),
    ('narrativex-vi-vn-male-1', 'NARRATIVEX', 'An', 'vi-VN', 'MALE', NULL, '{"style":"calm"}'::jsonb),
    ('vieneu-ngoc-huyen-v2', 'VIENEU', 'Ngọc Huyền v2', 'vi-VN', 'FEMALE', NULL, '{"style":"natural","local":true,"sdkVoiceName":"Ngọc Huyền v2","region":"Bắc"}'::jsonb),
    ('vieneu-minh-duc', 'VIENEU', 'Minh Đức', 'vi-VN', 'MALE', NULL, '{"style":"natural","local":true,"sdkVoiceName":"Minh Đức","region":"Bắc"}'::jsonb),
    ('vieneu-truc-ly', 'VIENEU', 'Trúc Ly', 'vi-VN', 'FEMALE', NULL, '{"style":"gentle","local":true,"sdkVoiceName":"Trúc Ly","region":"Bắc"}'::jsonb),
    ('vieneu-mai-anh', 'VIENEU', 'Mai Anh', 'vi-VN', 'FEMALE', NULL, '{"style":"expressive","local":true,"sdkVoiceName":"Mai Anh","region":"Bắc"}'::jsonb),
    ('vieneu-quynh-anh', 'VIENEU', 'Quỳnh Anh', 'vi-VN', 'FEMALE', NULL, '{"style":"clear","local":true,"sdkVoiceName":"Quỳnh Anh","region":"Bắc"}'::jsonb),
    ('vieneu-doan-trang', 'VIENEU', 'Đoan Trang', 'vi-VN', 'FEMALE', NULL, '{"style":"warm","local":true,"sdkVoiceName":"Đoan Trang","region":"Bắc"}'::jsonb),
    ('vieneu-pham-tuyen', 'VIENEU', 'Phạm Tuyên', 'vi-VN', 'MALE', NULL, '{"style":"formal","local":true,"sdkVoiceName":"Phạm Tuyên","region":"Bắc"}'::jsonb),
    ('vieneu-quang-son', 'VIENEU', 'Quang Sơn', 'vi-VN', 'MALE', NULL, '{"style":"narrative","local":true,"sdkVoiceName":"Quang Sơn","region":"Trung"}'::jsonb),
    ('vieneu-ngoc-tran', 'VIENEU', 'Ngọc Trân', 'vi-VN', 'FEMALE', NULL, '{"style":"melodic","local":true,"sdkVoiceName":"Ngọc Trân","region":"Trung"}'::jsonb),
    ('vieneu-adam', 'VIENEU', 'Adam', 'vi-VN', 'MALE', NULL, '{"style":"standard","local":true,"sdkVoiceName":"Adam","region":"Nam"}'::jsonb),
    ('vieneu-xuan-vinh', 'VIENEU', 'Xuân Vĩnh', 'vi-VN', 'MALE', NULL, '{"style":"deep","local":true,"sdkVoiceName":"Xuân Vĩnh","region":"Nam"}'::jsonb),
    ('vieneu-thai-son', 'VIENEU', 'Thái Sơn', 'vi-VN', 'MALE', NULL, '{"style":"energetic","local":true,"sdkVoiceName":"Thái Sơn","region":"Nam"}'::jsonb),
    ('vieneu-thuy-dung', 'VIENEU', 'Thùy Dung', 'vi-VN', 'FEMALE', NULL, '{"style":"soft","local":true,"sdkVoiceName":"Thùy Dung","region":"Nam"}'::jsonb),
    ('vieneu-my-duyen', 'VIENEU', 'Mỹ Duyên', 'vi-VN', 'FEMALE', NULL, '{"style":"bright","local":true,"sdkVoiceName":"Mỹ Duyên","region":"Nam"}'::jsonb),
    ('vieneu-minh-triet', 'VIENEU', 'Minh Triết', 'vi-VN', 'MALE', NULL, '{"style":"confident","local":true,"sdkVoiceName":"Minh Triết","region":"Nam"}'::jsonb),
    ('vieneu-duc-tri', 'VIENEU', 'Đức Trí', 'vi-VN', 'MALE', NULL, '{"style":"mature","local":true,"sdkVoiceName":"Đức Trí","region":"Nam"}'::jsonb),
    ('vieneu-thuc-doan', 'VIENEU', 'Thục Đoan', 'vi-VN', 'FEMALE', NULL, '{"style":"friendly","local":true,"sdkVoiceName":"Thục Đoan","region":"Nam"}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider,
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    gender = EXCLUDED.gender,
    metadata_json = EXCLUDED.metadata_json,
    enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP;
