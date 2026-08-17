package com.narrativex.backend.modules.project.application;

public record CreateProjectCommand(
    String name,
    String sourceLanguage,
    String narrationLanguage,
    String metadataLanguage,
    String imageAspectRatio,
    String imageQualityTier
) {
}
