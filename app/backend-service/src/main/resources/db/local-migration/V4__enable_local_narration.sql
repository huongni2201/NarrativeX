-- Local demo only: the seeded PRO plan is used to exercise narration end to end.
UPDATE plan_entitlements
   SET feature_flags_json = feature_flags_json || '{"narration": true}'::jsonb
 WHERE plan_key = 'PRO'
   AND version = 1
   AND feature_flags_json->>'narration' IS DISTINCT FROM 'true';
