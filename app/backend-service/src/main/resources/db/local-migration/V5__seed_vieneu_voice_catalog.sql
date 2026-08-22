-- Local/demo catalog entry for the worker's configured VieNeu custom voice.
-- The reference WAV is mounted into the worker at runtime and is never stored here.
INSERT INTO voice_catalog (id, provider, name, language, gender, sample_url, metadata_json)
VALUES (
    'vieneu-ngoc-huyen-v2',
    'VIENEU',
    'Ngọc Huyền v2',
    'vi-VN',
    'FEMALE',
    NULL,
    '{"style":"natural","local":true,"sdkVoiceName":"Ngọc Huyền v2"}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider,
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    gender = EXCLUDED.gender,
    metadata_json = EXCLUDED.metadata_json,
    enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP;
