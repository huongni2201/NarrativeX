package com.narrativex.backend.feature.assets.application.command;

public record CreateUploadIntentCommand(
    String assetType,
    String originalFilename,
    String contentType,
    long expectedSizeBytes,
    String expectedSha256) {}
