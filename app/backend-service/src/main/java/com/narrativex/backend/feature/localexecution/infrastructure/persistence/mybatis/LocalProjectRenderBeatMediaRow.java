package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderBeatMediaRow(
    UUID visualBeatId,
    String mediaType,
    Long sourceDurationMs,
    String fitMode,
    long trimStartMs) {}
