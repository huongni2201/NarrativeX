package com.narrativex.backend.feature.storyboard.api.response;

import java.util.UUID;

public record ChapterContentImportResponse(
    UUID variantId, String variantType, String languageDetectionStatus) {}
