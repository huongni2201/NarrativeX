package com.narrativex.backend.feature.catalog.application.query;

import java.time.Instant;
import java.util.List;

public record StylePresetView(
    Long id,
    String name,
    String category,
    String description,
    String thumbnailUrl,
    String promptSuffix,
    String negativePrompt,
    List<String> tags,
    String configJson,
    Instant createdAt) {}
