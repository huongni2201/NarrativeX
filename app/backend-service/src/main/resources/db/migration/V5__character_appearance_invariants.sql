-- Keep an appearance's outfit version attached to the same reusable character.
ALTER TABLE outfit_versions
    ADD CONSTRAINT uk_outfit_versions_id_character UNIQUE (id, character_id);

ALTER TABLE character_appearances
    ADD CONSTRAINT fk_character_appearances_outfit_character
    FOREIGN KEY (outfit_version_id, character_id)
    REFERENCES outfit_versions (id, character_id);
