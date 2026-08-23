CREATE TABLE local_device_pairing_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_local_device_pairing_codes_user
    ON local_device_pairing_codes (user_id, created_at DESC);

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

CREATE INDEX idx_local_devices_user
    ON local_devices (user_id, created_at DESC);

CREATE INDEX idx_local_devices_last_seen
    ON local_devices (last_seen_at DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE local_device_capabilities (
    device_id UUID NOT NULL REFERENCES local_devices(id) ON DELETE CASCADE,
    capability VARCHAR(64) NOT NULL,
    PRIMARY KEY (device_id, capability)
);
