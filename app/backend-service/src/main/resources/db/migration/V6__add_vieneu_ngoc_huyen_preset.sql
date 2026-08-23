-- Keep the application-managed Ngọc Huyền v2 reference profile and expose
-- VieNeu's built-in Ngọc Huyền preset as a separate catalog voice.
INSERT INTO voice_catalog (id, provider, name, language, gender, sample_url, metadata_json)
VALUES (
    'vieneu-ngoc-huyen',
    'VIENEU',
    'Ngọc Huyền',
    'vi-VN',
    'FEMALE',
    NULL,
    '{"style":"natural","local":true,"voiceSource":"PRESET","sdkVoiceName":"Ngọc Huyền","region":"Bắc","supportsSpeakingRate":false,"supportsVoiceClone":true,"supportsBatch":true,"sampleRateHz":48000,"executionSemantics":"LOCAL_RETRYABLE"}'::jsonb
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

UPDATE voice_catalog
SET metadata_json = metadata_json || '{"voiceSource":"REFERENCE_PROFILE"}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'vieneu-ngoc-huyen-v2';
