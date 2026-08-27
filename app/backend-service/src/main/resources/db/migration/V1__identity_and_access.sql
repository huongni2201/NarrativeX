-- NarrativeX pre-release PostgreSQL/Flyway baseline.
-- Requires PostgreSQL 18+ for native uuidv7() used by later domain migrations.
-- V1 owns identity, session, guest continuity, and local-device schema only.

-- -----------------------------------------------------------------------------
-- Authentication
-- -----------------------------------------------------------------------------

CREATE TABLE auth_users (
    id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(160) NOT NULL,
    avatar_url TEXT,
    google_subject VARCHAR(255) UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-authoritative desktop OAuth handoff state.
CREATE TABLE desktop_auth_handoffs (
    code_hash VARCHAR(43) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    code_challenge VARCHAR(43) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Spring Session JDBC schema is owned by Flyway in non-embedded environments.
CREATE TABLE SPRING_SESSION (
    PRIMARY_ID CHAR(36) NOT NULL,
    SESSION_ID CHAR(36) NOT NULL,
    CREATION_TIME BIGINT NOT NULL,
    LAST_ACCESS_TIME BIGINT NOT NULL,
    MAX_INACTIVE_INTERVAL INT NOT NULL,
    EXPIRY_TIME BIGINT NOT NULL,
    PRINCIPAL_NAME VARCHAR(128),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE TABLE SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36) NOT NULL,
    ATTRIBUTE_NAME VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES BYTEA NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK
        FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION(PRIMARY_ID)
        ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Local execution devices
-- -----------------------------------------------------------------------------

CREATE TABLE local_device_pairing_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE local_devices (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(160) NOT NULL,
    platform VARCHAR(80) NOT NULL,
    agent_version VARCHAR(64) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    last_seen_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE local_device_capabilities (
    device_id UUID NOT NULL REFERENCES local_devices(id) ON DELETE CASCADE,
    capability VARCHAR(64) NOT NULL,
    PRIMARY KEY (device_id, capability)
);

-- Stable guest identities for NarrativeX Desktop installations.
-- The guest principal remains an internal auth row only; Google is still the only
-- persisted end-user login provider. Installation secrets are stored as SHA-256 hashes.
CREATE TABLE desktop_guest_installations (
    device_id UUID PRIMARY KEY,
    guest_user_id VARCHAR(128) NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
    secret_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_desktop_guest_installations_secret_hash
        CHECK (secret_hash ~ '^[0-9a-f]{64}$')
);
