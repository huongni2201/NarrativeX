package com.narrativex.backend.feature.localexecution.application.query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record LocalDeviceView(
    UUID id,
    String name,
    String platform,
    String agentVersion,
    List<String> capabilities,
    Instant lastSeenAt,
    boolean online) {}
