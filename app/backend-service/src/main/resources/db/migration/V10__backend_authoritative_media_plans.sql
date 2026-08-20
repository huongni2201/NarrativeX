CREATE TABLE media_plans (
  id UUID PRIMARY KEY,
  chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_row_version BIGINT NOT NULL CHECK (chapter_row_version >= 0),
  source_hash VARCHAR(64) NOT NULL,
  production_mode VARCHAR(32) NOT NULL
    CHECK (production_mode IN ('IMAGE_MOTION', 'HYBRID_LOCAL_I2V')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  narration_characters BIGINT NOT NULL CHECK (narration_characters >= 0),
  image_generate_count INTEGER NOT NULL CHECK (image_generate_count >= 0),
  image_edit_count INTEGER NOT NULL CHECK (image_edit_count >= 0),
  basic_motion_seconds INTEGER NOT NULL CHECK (basic_motion_seconds >= 0),
  planned_i2v_seconds INTEGER NOT NULL CHECK (planned_i2v_seconds >= 0),
  estimated_cost NUMERIC(19, 6) NOT NULL CHECK (estimated_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_media_plans_chapter_revision UNIQUE (chapter_id, revision),
  CONSTRAINT uq_media_plans_job_pointer UNIQUE (id, revision, production_mode)
);

CREATE INDEX idx_media_plans_chapter_created
  ON media_plans (chapter_id, created_at DESC);

CREATE TABLE media_scene_plans (
  media_plan_id UUID NOT NULL REFERENCES media_plans(id) ON DELETE CASCADE,
  scene_index INTEGER NOT NULL CHECK (scene_index >= 0),
  scene_id BIGINT NOT NULL,
  scene_order_index INTEGER NOT NULL CHECK (scene_order_index >= 0),
  narration TEXT,
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  PRIMARY KEY (media_plan_id, scene_index)
);

CREATE TABLE media_beat_plans (
  media_plan_id UUID NOT NULL,
  scene_index INTEGER NOT NULL,
  beat_index INTEGER NOT NULL CHECK (beat_index >= 0),
  visual_beat_id BIGINT NOT NULL,
  visual_beat_order_index INTEGER NOT NULL CHECK (visual_beat_order_index >= 0),
  visual_intent TEXT NOT NULL,
  semantic_motion_mode VARCHAR(32) NOT NULL
    CHECK (semantic_motion_mode IN ('STILL', 'BASIC_MOTION', 'AI_VIDEO')),
  motion_strategy VARCHAR(32) NOT NULL
    CHECK (motion_strategy IN ('BASIC_IMAGE_MOTION', 'IMAGE_TO_VIDEO')),
  PRIMARY KEY (media_plan_id, scene_index, beat_index),
  CONSTRAINT fk_media_beat_plan_scene
    FOREIGN KEY (media_plan_id, scene_index)
    REFERENCES media_scene_plans(media_plan_id, scene_index)
    ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION reject_media_plan_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is immutable; create a new media plan revision instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_plans_immutable
BEFORE UPDATE ON media_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE TRIGGER trg_media_scene_plans_immutable
BEFORE UPDATE ON media_scene_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

CREATE TRIGGER trg_media_beat_plans_immutable
BEFORE UPDATE ON media_beat_plans
FOR EACH ROW EXECUTE FUNCTION reject_media_plan_update();

ALTER TABLE generation_jobs
  ADD COLUMN media_plan_id UUID,
  ADD COLUMN media_plan_revision INTEGER,
  ADD COLUMN production_mode VARCHAR(32);

ALTER TABLE generation_jobs
  ADD CONSTRAINT ck_generation_jobs_media_plan_pointer
  CHECK (
    (media_plan_id IS NULL AND media_plan_revision IS NULL AND production_mode IS NULL)
    OR
    (media_plan_id IS NOT NULL AND media_plan_revision IS NOT NULL AND production_mode IS NOT NULL)
  ),
  ADD CONSTRAINT ck_generation_jobs_production_mode
  CHECK (
    production_mode IS NULL
    OR production_mode IN ('IMAGE_MOTION', 'HYBRID_LOCAL_I2V')
  ),
  ADD CONSTRAINT fk_generation_jobs_media_plan
  FOREIGN KEY (media_plan_id, media_plan_revision, production_mode)
  REFERENCES media_plans(id, revision, production_mode);

CREATE INDEX idx_generation_jobs_media_plan_id
  ON generation_jobs(media_plan_id)
  WHERE media_plan_id IS NOT NULL;
