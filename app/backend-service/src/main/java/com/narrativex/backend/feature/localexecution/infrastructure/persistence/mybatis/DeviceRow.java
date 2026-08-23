package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;

public record DeviceRow(UUID id, String userId, Instant revokedAt) {}
