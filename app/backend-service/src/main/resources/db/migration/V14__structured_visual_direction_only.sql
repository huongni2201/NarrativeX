-- Complete the visual-direction cut-over before removing the lossy legacy camera columns.
-- Existing structured rows remain untouched. Legacy/manual rows without structured JSON receive a
-- deterministic compatibility snapshot so no persisted camera intent is silently discarded.

UPDATE visual_beats
   SET visual_direction_json = jsonb_build_object(
           'shot_size', CASE camera_angle
               WHEN 'WIDE' THEN 'WIDE'
               WHEN 'CLOSE_UP' THEN 'CLOSE_UP'
               WHEN 'EXTREME_CLOSE_UP' THEN 'EXTREME_CLOSE_UP'
               ELSE 'MEDIUM'
           END,
           'camera_angle', CASE camera_angle
               WHEN 'LOW_ANGLE' THEN 'LOW'
               WHEN 'HIGH_ANGLE' THEN 'HIGH'
               WHEN 'OVER_THE_SHOULDER' THEN 'OVER_SHOULDER'
               WHEN 'POV' THEN 'POV'
               ELSE 'EYE_LEVEL'
           END,
           'lens_mm', 50,
           'focus_target', 'primary story subject',
           'action_phase', 'AFTER',
           'subject_placement', 'balanced middle-third composition',
           'foreground', NULL,
           'background', 'source-grounded environment',
           'motivated_light', 'source-grounded motivated light',
           'palette', 'scene-appropriate restrained palette',
           'camera_movement', CASE camera_movement
               WHEN 'ZOOM_IN' THEN 'PUSH_IN'
               WHEN 'ZOOM_OUT' THEN 'PULL_OUT'
               WHEN 'TRACK' THEN 'PARALLAX'
               ELSE COALESCE(camera_movement, 'NONE')
           END,
           'movement_direction', NULL,
           'movement_intensity', 'SUBTLE',
           'crop_safe_area', 'modest crop room on all sides'
       )::text,
       updated_at = CURRENT_TIMESTAMP,
       row_version = row_version + 1
 WHERE visual_direction_json IS NULL
    OR BTRIM(visual_direction_json) = '';

ALTER TABLE visual_beats
    DROP CONSTRAINT IF EXISTS ck_visual_beats_camera_movement,
    DROP CONSTRAINT IF EXISTS ck_visual_beats_camera_angle;

ALTER TABLE visual_beats
    DROP COLUMN IF EXISTS camera_movement,
    DROP COLUMN IF EXISTS camera_angle;
