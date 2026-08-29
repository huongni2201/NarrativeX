-- Normalize the public account-tier vocabulary while preserving existing quota infrastructure.
-- STANDARD was a legacy account tier. Media quality STANDARD remains unrelated and unchanged.

UPDATE user_plan_assignments
   SET plan_key = 'NORMAL',
       entitlement_version = 1
 WHERE plan_key = 'STANDARD';

DELETE FROM plan_entitlements
 WHERE plan_key = 'STANDARD';

ALTER TABLE plan_entitlements
    ADD CONSTRAINT ck_plan_entitlements_plan_key
        CHECK (plan_key IN ('NORMAL', 'PRO', 'ULTRA'));

ALTER TABLE user_plan_assignments
    ADD CONSTRAINT ck_user_plan_assignments_plan_key
        CHECK (plan_key IN ('NORMAL', 'PRO', 'ULTRA'));
