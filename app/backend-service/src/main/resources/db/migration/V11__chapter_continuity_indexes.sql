-- Access paths for continuity snapshots and durable analysis checkpoints.

CREATE INDEX idx_chapter_continuity_plans_current
    ON chapter_continuity_plans (chapter_id, revision DESC);
CREATE INDEX idx_chapter_continuity_plans_story_source
    ON chapter_continuity_plans (story_version_id, chapter_id, source_hash);
CREATE INDEX idx_scene_continuity_states_plan_scene
    ON scene_continuity_states (plan_id, scene_id);
CREATE INDEX idx_visual_beat_continuity_states_plan_beat
    ON visual_beat_continuity_states (plan_id, visual_beat_id);
CREATE INDEX idx_visual_beat_continuity_states_semantic_hash
    ON visual_beat_continuity_states (semantic_hash);
CREATE INDEX idx_continuity_reports_plan_revision
    ON continuity_reports (plan_id, revision DESC);

CREATE INDEX idx_analysis_checkpoints_resume
    ON analysis_checkpoints (stage_attempt_id, status, updated_at);
CREATE INDEX idx_analysis_checkpoints_provider_operation
    ON analysis_checkpoints (provider_operation_id)
    WHERE provider_operation_id IS NOT NULL;
