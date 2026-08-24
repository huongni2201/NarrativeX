package com.narrativex.backend.feature.assets.api.response;

import java.time.Instant;

public record MediaAssetDownloadUrlResponse(
    String url, Instant expiresAt, String contentType, String filename) {}
