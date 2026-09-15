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

