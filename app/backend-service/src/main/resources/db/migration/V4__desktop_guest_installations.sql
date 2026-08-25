-- Stable guest identities for NarrativeX Desktop installations.
-- The guest principal remains an internal auth row only; Google is still the only
-- persisted end-user login provider. Installation secrets are stored as SHA-256 hashes.

CREATE TABLE desktop_guest_installations (
    device_id UUID PRIMARY KEY,
    guest_user_id VARCHAR(128) NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
    secret_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_desktop_guest_installations_last_seen
    ON desktop_guest_installations (last_seen_at DESC);
