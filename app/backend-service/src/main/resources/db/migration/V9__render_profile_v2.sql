ALTER TABLE project_render_input_snapshots
  DROP CONSTRAINT IF EXISTS ck_project_render_profile_version;

ALTER TABLE project_render_input_snapshots
  ADD CONSTRAINT ck_project_render_profile_version
  CHECK ((render_profile_json ->> 'schemaVersion')::INTEGER IN (1, 2));
