UPDATE voice_catalog
   SET metadata_json = jsonb_set(
           COALESCE(metadata_json, '{}'::jsonb),
           '{supportsSpeakingRate}',
           'true'::jsonb,
           true
       ),
       updated_at = CURRENT_TIMESTAMP
 WHERE provider = 'VIENEU'
   AND enabled = TRUE;
