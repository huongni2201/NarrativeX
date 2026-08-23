package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.time.Instant;

public record PairingCodeRow(long id, String userId, Instant expiresAt, Instant consumedAt) {}
