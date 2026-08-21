package com.narrativex.backend.feature.catalog.application.query;

import java.time.Instant;

public record VoiceView(
    String id,
    String provider,
    String name,
    String language,
    String gender,
    String sampleUrl,
    String metadataJson,
    Instant updatedAt) {}
