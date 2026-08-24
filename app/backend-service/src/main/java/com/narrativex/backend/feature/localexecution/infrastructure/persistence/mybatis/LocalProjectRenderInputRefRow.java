package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

public record LocalProjectRenderInputRefRow(
    String storageKey, long sizeBytes, String checksum, String mediaKind) {}
