ALTER TABLE project_render_input_snapshots
    DROP CONSTRAINT ck_project_render_profile_version;

ALTER TABLE project_render_input_snapshots
    ADD CONSTRAINT ck_project_render_profile_version
        CHECK ((render_profile_json ->> 'schemaVersion')::integer IN (2, 3)),
    ADD CONSTRAINT ck_project_render_profile_v3_watermark
        CHECK (
            (render_profile_json ->> 'schemaVersion')::integer = 2
            OR (
                jsonb_typeof(render_profile_json -> 'watermark') = 'object'
                AND render_profile_json -> 'watermark' ->> 'mode' IN ('required', 'none')
                AND (render_profile_json -> 'watermark' ->> 'policyVersion')::integer = 1
            )
        );
