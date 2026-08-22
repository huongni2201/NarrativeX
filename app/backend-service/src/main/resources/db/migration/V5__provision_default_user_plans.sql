-- Every existing account must have the same default entitlement that new
-- registrations receive. Existing assignments are preserved.
INSERT INTO user_plan_assignments
    (user_id, plan_key, entitlement_version, status, period_start, period_end)
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
