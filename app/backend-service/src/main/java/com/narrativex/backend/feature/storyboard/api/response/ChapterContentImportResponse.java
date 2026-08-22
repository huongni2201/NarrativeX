package com.narrativex.backend.feature.storyboard.api.response;

public record ChapterContentImportResponse(
    Long variantId, String variantType, String languageDetectionStatus) {}
