-- Route immutable project render snapshots either to the existing cloud worker
-- or to one explicitly assigned NarrativeX desktop device.

ALTER TABLE project_render_input_snapshots
    ADD COLUMN execution_target VARCHAR(24) NOT NULL DEFAULT 'CLOUD',
    ADD COLUMN assigned_local_device_id UUID REFERENCES local_devices(id);

ALTER TABLE project_render_input_snapshots
    ADD CONSTRAINT ck_project_render_execution_target
        CHECK (execution_target IN ('CLOUD', 'LOCAL_DEVICE')),
    ADD CONSTRAINT ck_project_render_execution_assignment
        CHECK (
            (execution_target = 'CLOUD' AND assigned_local_device_id IS NULL)
            OR
            (execution_target = 'LOCAL_DEVICE' AND assigned_local_device_id IS NOT NULL)
        );

CREATE INDEX idx_project_render_input_local_claim
    ON project_render_input_snapshots (assigned_local_device_id, created_at, generation_job_id)
    WHERE execution_target = 'LOCAL_DEVICE';

COMMENT ON COLUMN project_render_input_snapshots.execution_target IS
    'Execution routing for immutable project renders. CLOUD uses the Python fallback worker; LOCAL_DEVICE is claimed by the assigned NarrativeX desktop device.';
COMMENT ON COLUMN project_render_input_snapshots.assigned_local_device_id IS
    'Paired desktop device assigned to LOCAL_DEVICE project rendering. Null for CLOUD renders.';
