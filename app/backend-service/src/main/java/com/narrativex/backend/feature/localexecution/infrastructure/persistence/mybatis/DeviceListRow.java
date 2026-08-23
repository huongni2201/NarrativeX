package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;

public record DeviceListRow(
    UUID id,
    String name,
    String platform,
    String agentVersion,
    Instant lastSeenAt,
    boolean online) {}
