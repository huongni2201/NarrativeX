-- NarrativeX pre-release baseline: deterministic catalog/system bootstrap only.
-- Application/user content must never be embedded in Flyway migrations.

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

-- VieNeu v3 Turbo preset voices (names per the pinned VieNeu-TTS 3.8.1 README). The worker resolves
-- providerVoice by name; gender is not published upstream, so it stays unset. sample_url points at the
-- pre-rendered 10-15 second sample hosted on R2 (scripts/generate-voice-samples.mjs renders the files).
INSERT INTO voice_catalog (
    id, provider, name, language, gender, sample_url, metadata_json
)
SELECT 'vieneu-preset-' || v.slug,
       'VIENEU',
       v.display_name,
       'vi-VN',
       NULL,
       'https://media.narrativex.cloud/narration/vieneu-previews/vieneu-' || v.slug || '.wav',
       jsonb_build_object(
           'style', 'preset',
           'local', TRUE,
           'preset', TRUE,
           'providerVoice', v.display_name,
           'featured', v.featured,
           'model', 'vieneu-v3-turbo',
           'supportsSpeakingRate', TRUE,
           'supportsVoiceClone', TRUE,
           'supportsBatch', FALSE,
           'sampleRateHz', 48000,
           'outputFormat', 'wav',
           'executionSemantics', 'LOCAL_RETRYABLE'
       ) || CASE WHEN v.region IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('region', v.region) END
  FROM (VALUES
        ('adam-bua', 'Adam bựa', TRUE, NULL),
        ('truc-ly', 'Trúc Ly', TRUE, NULL),
        ('anh-khoi', 'Anh Khôi', TRUE, NULL),
        ('mai-anh', 'Mai Anh', TRUE, NULL),
        ('minh-quan-pro', 'Minh Quân Pro', TRUE, NULL),
        ('thuy-dung', 'Thùy Dung', TRUE, NULL),
        ('thien-tam-duc', 'Thiền Tâm Đức', TRUE, NULL),
        ('ngoc-huyen', 'Ngọc Huyền', TRUE, NULL),
        ('quang-son', 'Quang Sơn', TRUE, 'central'),
        ('ngoc-tran', 'Ngọc Trân', TRUE, 'central'),
        ('minh-duc', 'Minh Đức', FALSE, 'north'),
        ('pham-tuyen', 'Phạm Tuyên', FALSE, 'north'),
        ('xuan-vinh', 'Xuân Vĩnh', FALSE, 'north'),
        ('thanh-binh', 'Thanh Bình', FALSE, 'north'),
        ('ngoc-linh', 'Ngọc Linh', FALSE, 'north'),
        ('doan-trang', 'Đoan Trang', FALSE, 'north'),
        ('quynh-anh', 'Quỳnh Anh', FALSE, 'north'),
        ('manh-dung', 'Mạnh Dũng', FALSE, 'north'),
        ('adam', 'Adam', FALSE, 'south'),
        ('thai-son', 'Thái Sơn', FALSE, 'south'),
        ('thuc-doan', 'Thục Đoan', FALSE, 'south'),
        ('minh-triet', 'Minh Triết', FALSE, 'south'),
        ('my-duyen', 'Mỹ Duyên', FALSE, 'south'),
        ('duc-tri', 'Đức Trí', FALSE, 'south'),
        ('kim-thanh', 'Kim Thanh', FALSE, 'south')
       ) AS v(slug, display_name, featured, region)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider,
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    gender = EXCLUDED.gender,
    sample_url = EXCLUDED.sample_url,
    metadata_json = EXCLUDED.metadata_json,
    enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- Singleton chapter-analysis runtime configuration row (all values use column defaults).
INSERT INTO analysis_runtime_configuration (singleton_id) VALUES (TRUE);
