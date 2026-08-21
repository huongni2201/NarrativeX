package com.narrativex.backend.feature.assets.application.query;

import java.util.UUID;

public record UploadFinalizeView(UUID uploadSessionId, String status, UUID mediaAssetId) {}
