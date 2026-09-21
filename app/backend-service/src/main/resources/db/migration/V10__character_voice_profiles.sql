-- NarrativeX: Character Voice Identity & Profiles (ADR-0020, ADR-0026)

-- 1. Create character_voice_profiles table
CREATE TABLE character_voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    row_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    reference_asset_id UUID,
    reference_scope VARCHAR(32) NOT NULL DEFAULT 'GLOBAL_LOCAL',
    language VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    accent VARCHAR(64),
    voice_description TEXT NOT NULL DEFAULT '',
    delivery_baseline TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    locked_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_character_voice_profiles_version UNIQUE (character_id, version_number),
    CONSTRAINT ck_character_voice_profiles_scope CHECK (reference_scope IN ('PROJECT', 'GLOBAL_LOCAL')),
    CONSTRAINT ck_character_voice_profiles_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

-- 2. Add pinned_voice_profile_id to characters and project_characters
ALTER TABLE characters
    ADD COLUMN IF NOT EXISTS pinned_voice_profile_id UUID REFERENCES character_voice_profiles(id) ON DELETE SET NULL;

ALTER TABLE project_characters
    ADD COLUMN IF NOT EXISTS pinned_voice_profile_id UUID REFERENCES character_voice_profiles(id) ON DELETE SET NULL;
