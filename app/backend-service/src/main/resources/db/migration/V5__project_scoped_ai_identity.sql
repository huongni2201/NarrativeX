-- Durable project-scoped identity for AI continuity mentions.
-- Names remain descriptive attributes/evidence and are never relational identity keys.

CREATE UNIQUE INDEX uq_project_characters_project_id_id
    ON project_characters (project_id, id);

CREATE UNIQUE INDEX uq_project_locations_project_id_id
    ON project_locations (project_id, id);

CREATE TABLE project_character_ai_identities (
    project_id BIGINT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    ai_key VARCHAR(64) NOT NULL,
    project_character_id BIGINT NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen_chapter_id BIGINT
        REFERENCES chapters(id)
        ON DELETE SET NULL,
    last_seen_chapter_id BIGINT
        REFERENCES chapters(id)
        ON DELETE SET NULL,
    match_basis VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_character_ai_identities PRIMARY KEY (project_id, ai_key),
    CONSTRAINT fk_project_character_ai_identity_entity
        FOREIGN KEY (project_id, project_character_id)
        REFERENCES project_characters(project_id, id)
        ON DELETE CASCADE,
    CONSTRAINT ck_project_character_ai_identity_key
        CHECK (ai_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_project_character_ai_identity_match_basis
        CHECK (match_basis IN ('EXACT_KEY', 'ALIAS', 'OBSERVATION', 'CANDIDATE', 'CREATED')),
    CONSTRAINT ck_project_character_ai_identity_confidence
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX idx_project_character_ai_identity_entity
    ON project_character_ai_identities (project_id, project_character_id);

CREATE TABLE project_location_ai_identities (
    project_id BIGINT NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    ai_key VARCHAR(64) NOT NULL,
    project_location_id BIGINT NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen_chapter_id BIGINT
        REFERENCES chapters(id)
        ON DELETE SET NULL,
    last_seen_chapter_id BIGINT
        REFERENCES chapters(id)
        ON DELETE SET NULL,
    match_basis VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project_location_ai_identities PRIMARY KEY (project_id, ai_key),
    CONSTRAINT fk_project_location_ai_identity_entity
        FOREIGN KEY (project_id, project_location_id)
        REFERENCES project_locations(project_id, id)
        ON DELETE CASCADE,
    CONSTRAINT ck_project_location_ai_identity_key
        CHECK (ai_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_project_location_ai_identity_match_basis
        CHECK (match_basis IN ('EXACT_KEY', 'ALIAS', 'OBSERVATION', 'CANDIDATE', 'CREATED')),
    CONSTRAINT ck_project_location_ai_identity_confidence
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX idx_project_location_ai_identity_entity
    ON project_location_ai_identities (project_id, project_location_id);
