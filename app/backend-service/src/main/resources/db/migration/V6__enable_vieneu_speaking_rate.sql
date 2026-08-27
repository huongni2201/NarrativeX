-- Enable speaking-rate controls for the VieNeu catalog without mutating the frozen V3 seed.
UPDATE voice_catalog
SET metadata_json = jsonb_set(metadata_json, '{supportsSpeakingRate}', 'true'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE provider = 'VIENEU';
