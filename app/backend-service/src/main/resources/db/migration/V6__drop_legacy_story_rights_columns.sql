ALTER TABLE story_versions
    DROP COLUMN IF EXISTS rights_attested,
    DROP COLUMN IF EXISTS rights_policy_version,
    DROP COLUMN IF EXISTS rights_basis,
    DROP COLUMN IF EXISTS rights_attested_at,
    DROP COLUMN IF EXISTS rights_attested_by;
