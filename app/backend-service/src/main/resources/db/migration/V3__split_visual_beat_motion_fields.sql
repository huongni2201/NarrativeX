-- Split render strategy from camera movement. V2 intentionally remains immutable.

ALTER TABLE visual_beats
    ADD COLUMN motion_mode VARCHAR(24),
    ADD COLUMN camera_movement VARCHAR(32);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM visual_beats
         WHERE motion_action NOT IN (
            'STILL', 'STATIC', 'BASIC_MOTION', 'AI_VIDEO', 'PAN', 'TILT',
            'PUSH_IN', 'PULL_OUT', 'TRACK', 'ZOOM_IN', 'ZOOM_OUT',
            'PARALLAX', 'RISE', 'DISSOLVE'
         )
    ) THEN
        RAISE EXCEPTION 'Unknown legacy visual_beats.motion_action value cannot be migrated';
    END IF;
END $$;

UPDATE visual_beats
   SET motion_mode = CASE
       WHEN motion_action IN ('STILL', 'STATIC', 'DISSOLVE') THEN 'STILL'
       WHEN motion_action = 'AI_VIDEO' THEN 'AI_VIDEO'
       ELSE 'BASIC_MOTION'
   END,
       camera_movement = CASE
       WHEN motion_action IN ('PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK', 'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX')
           THEN motion_action
       WHEN motion_action = 'RISE' THEN 'TILT'
       ELSE 'NONE'
   END;

ALTER TABLE visual_beats
    ALTER COLUMN motion_mode SET DEFAULT 'STILL',
    ALTER COLUMN motion_mode SET NOT NULL,
    ALTER COLUMN camera_movement SET DEFAULT 'NONE',
    ALTER COLUMN camera_movement SET NOT NULL;

ALTER TABLE visual_beats
    ADD CONSTRAINT ck_visual_beats_motion_mode
        CHECK (motion_mode IN ('STILL', 'BASIC_MOTION', 'AI_VIDEO')),
    ADD CONSTRAINT ck_visual_beats_camera_movement
        CHECK (camera_movement IN ('NONE', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'TRACK', 'ZOOM_IN', 'ZOOM_OUT', 'PARALLAX'));

ALTER TABLE visual_beats DROP COLUMN motion_action;
