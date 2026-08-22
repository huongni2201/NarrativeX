-- Make TTS runtime capabilities explicit in the voice catalog so backend/UI clients
-- can render supported controls without hard-coding provider behavior.
UPDATE voice_catalog
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'supportsSpeakingRate', FALSE,
        'supportsVoiceClone', TRUE,
        'supportsBatch', TRUE,
        'sampleRateHz', 48000,
        'executionSemantics', 'LOCAL_RETRYABLE'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE provider = 'VIENEU';

UPDATE voice_catalog
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'supportsSpeakingRate', TRUE,
        'supportsVoiceClone', FALSE,
        'supportsBatch', FALSE,
        'sampleRateHz', 48000,
        'executionSemantics', 'EXTERNAL_DURABLE'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE provider <> 'VIENEU';
