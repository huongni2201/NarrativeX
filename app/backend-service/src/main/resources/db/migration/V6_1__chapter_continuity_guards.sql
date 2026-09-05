-- NarrativeX pre-release baseline slice: continuity/checkpoint immutability guards.

CREATE OR REPLACE FUNCTION reject_continuity_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; create a new continuity revision instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_continuity_plans_immutable
BEFORE UPDATE OR DELETE ON chapter_continuity_plans
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE TRIGGER trg_scene_continuity_states_immutable
BEFORE UPDATE OR DELETE ON scene_continuity_states
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE TRIGGER trg_visual_beat_continuity_states_immutable
BEFORE UPDATE OR DELETE ON visual_beat_continuity_states
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE TRIGGER trg_continuity_reports_immutable
BEFORE UPDATE OR DELETE ON continuity_reports
FOR EACH ROW EXECUTE FUNCTION reject_continuity_snapshot_mutation();

CREATE OR REPLACE FUNCTION guard_completed_analysis_checkpoint()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'COMPLETED' THEN
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.result_json IS DISTINCT FROM OLD.result_json
           OR NEW.result_hash IS DISTINCT FROM OLD.result_hash
           OR NEW.provider_operation_id IS DISTINCT FROM OLD.provider_operation_id THEN
            RAISE EXCEPTION 'completed analysis checkpoint result is immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analysis_checkpoint_terminal_immutable
BEFORE UPDATE ON analysis_checkpoints
FOR EACH ROW EXECUTE FUNCTION guard_completed_analysis_checkpoint();
