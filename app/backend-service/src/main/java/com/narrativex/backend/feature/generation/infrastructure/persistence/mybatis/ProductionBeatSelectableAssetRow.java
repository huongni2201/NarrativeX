package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;

public record ProductionBeatSelectableAssetRow(
    UUID mediaAssetId,
    String mediaType,
    String storageMode,
    Long durationMs,
    long sizeBytes,
    String checksum) {}
