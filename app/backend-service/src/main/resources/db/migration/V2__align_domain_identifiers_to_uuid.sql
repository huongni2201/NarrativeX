-- Align the PostgreSQL schema with the UUID domain/persistence contracts introduced by the
-- UUID identifier refactor.  This migration is deliberately data-preserving: legacy BIGINT
-- identifiers are deterministically embedded into UUID values so PK/FK relationships survive.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION narrativex_legacy_bigint_to_uuid(value BIGINT)
RETURNS UUID
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
    SELECT (
        '00000000-0000-0000-'
        || substr(hex_value, 1, 4)
        || '-'
        || substr(hex_value, 5, 12)
    )::uuid
    FROM (SELECT lpad(to_hex(value), 16, '0') AS hex_value) encoded;
$$;

-- Save FK definitions before changing referenced/referencing column types.  Rebuilding from
-- pg_get_constraintdef keeps ON DELETE/UPDATE, MATCH and deferrability semantics intact.
CREATE TEMP TABLE narrativex_uuid_fk_backup ON COMMIT DROP AS
SELECT
    ns.nspname AS schema_name,
    cls.relname AS table_name,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE con.contype = 'f'
  AND ns.nspname = 'public';

DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT schema_name, table_name, constraint_name
        FROM narrativex_uuid_fk_backup
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT %I',
            fk.schema_name,
            fk.table_name,
            fk.constraint_name
        );
    END LOOP;
END
$$;

-- Core/domain aggregate and entity tables whose Java identity is UUID.
CREATE TEMP TABLE narrativex_uuid_identity_tables (
    table_name TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO narrativex_uuid_identity_tables (table_name) VALUES
    ('projects'),
    ('story_versions'),
    ('chapters'),
    ('chapter_creation_idempotency'),
    ('chapter_content_variants'),
    ('storyboard_revisions'),
    ('characters'),
    ('character_versions'),
    ('outfit_versions'),
    ('character_appearances'),
    ('project_characters'),
    ('project_locations'),
    ('project_assets'),
    ('scenes'),
    ('visual_beats'),
    ('generation_jobs'),
    ('stage_attempts'),
    ('provider_operations'),
    ('operation_plans');

-- Convert every BIGINT FK column that referenced one of the UUID identity PKs.  The mapping is
-- derived from the original constraints, so newly-added FK consumers cannot silently stay BIGINT.
DO $$
DECLARE
    column_ref RECORD;
BEGIN
    FOR column_ref IN
        SELECT DISTINCT
            child_ns.nspname AS schema_name,
            child.relname AS table_name,
            child_attr.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class child ON child.oid = con.conrelid
        JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
        JOIN pg_class parent ON parent.oid = con.confrelid
        JOIN LATERAL unnest(con.conkey) WITH ORDINALITY child_key(attnum, ord) ON TRUE
        JOIN LATERAL unnest(con.confkey) WITH ORDINALITY parent_key(attnum, ord)
          ON parent_key.ord = child_key.ord
        JOIN pg_attribute child_attr
          ON child_attr.attrelid = child.oid
         AND child_attr.attnum = child_key.attnum
        JOIN pg_attribute parent_attr
          ON parent_attr.attrelid = parent.oid
         AND parent_attr.attnum = parent_key.attnum
        JOIN narrativex_uuid_identity_tables targets
          ON targets.table_name = parent.relname
        WHERE con.contype = 'f'
          AND child_ns.nspname = 'public'
          AND parent_attr.attname = 'id'
          AND format_type(child_attr.atttypid, child_attr.atttypmod) = 'bigint'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE UUID USING narrativex_legacy_bigint_to_uuid(%I)',
            column_ref.schema_name,
            column_ref.table_name,
            column_ref.column_name,
            column_ref.column_name
        );
    END LOOP;
END
$$;

-- Convert the authoritative PKs themselves and replace identity sequences with UUID defaults.
DO $$
DECLARE
    target RECORD;
    current_type TEXT;
BEGIN
    FOR target IN SELECT table_name FROM narrativex_uuid_identity_tables LOOP
        SELECT data_type
          INTO current_type
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = target.table_name
           AND column_name = 'id';

        IF current_type = 'bigint' THEN
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN id DROP IDENTITY IF EXISTS',
                target.table_name
            );
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN id TYPE UUID USING narrativex_legacy_bigint_to_uuid(id)',
                target.table_name
            );
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()',
                target.table_name
            );
        END IF;
    END LOOP;
END
$$;

-- UUID-valued logical job identifier was historically stored as VARCHAR(36).
ALTER TABLE generation_jobs
    ALTER COLUMN job_id TYPE UUID
    USING (
        CASE
            WHEN job_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                THEN job_id::uuid
            ELSE md5(job_id)::uuid
        END
    );

-- Pointer columns without an FK still participate in UUID domain contracts.
ALTER TABLE media_scene_plans
    ALTER COLUMN scene_id TYPE UUID
    USING narrativex_legacy_bigint_to_uuid(scene_id);

ALTER TABLE media_beat_plans
    ALTER COLUMN visual_beat_id TYPE UUID
    USING narrativex_legacy_bigint_to_uuid(visual_beat_id);

ALTER TABLE identity_consents
    ALTER COLUMN character_id TYPE UUID
    USING narrativex_legacy_bigint_to_uuid(character_id),
    ALTER COLUMN reference_asset_id TYPE UUID
    USING narrativex_legacy_bigint_to_uuid(reference_asset_id);

ALTER TABLE identity_profiles
    ALTER COLUMN character_id TYPE UUID
    USING narrativex_legacy_bigint_to_uuid(character_id);

-- Re-create every FK exactly as it existed before the type migration.
DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT schema_name, table_name, constraint_name, constraint_definition
        FROM narrativex_uuid_fk_backup
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
            fk.schema_name,
            fk.table_name,
            fk.constraint_name,
            fk.constraint_definition
        );
    END LOOP;
END
$$;

DROP FUNCTION narrativex_legacy_bigint_to_uuid(BIGINT);
