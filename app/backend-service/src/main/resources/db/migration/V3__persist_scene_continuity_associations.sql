-- Persist Chapter analysis continuity associations instead of dropping provider output.

ALTER TABLE scenes
    ADD COLUMN project_location_id BIGINT;

ALTER TABLE scenes
    ADD CONSTRAINT fk_scenes_project_location
    FOREIGN KEY (project_location_id)
    REFERENCES project_locations(id)
    ON DELETE SET NULL;

CREATE INDEX idx_scenes_project_location
    ON scenes (project_location_id)
    WHERE project_location_id IS NOT NULL;

CREATE TABLE scene_characters (
    scene_id BIGINT NOT NULL
        REFERENCES scenes(id)
        ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    project_character_id BIGINT NOT NULL
        REFERENCES project_characters(id),
    CONSTRAINT pk_scene_characters
        PRIMARY KEY (scene_id, project_character_id),
    CONSTRAINT uk_scene_characters_scene_order
        UNIQUE (scene_id, order_index),
    CONSTRAINT ck_scene_characters_order_nonnegative
        CHECK (order_index >= 0)
);

CREATE INDEX idx_scene_characters_project_character
    ON scene_characters (project_character_id);
