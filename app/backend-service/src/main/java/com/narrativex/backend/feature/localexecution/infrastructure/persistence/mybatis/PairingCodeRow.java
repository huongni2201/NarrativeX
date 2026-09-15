package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.time.Instant;

public record PairingCodeRow(long id, Instant expiresAt, Instant consumedAt) {}
