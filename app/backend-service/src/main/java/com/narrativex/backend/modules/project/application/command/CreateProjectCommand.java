package com.narrativex.backend.modules.project.application.command;

public record CreateProjectCommand(
    String name,
    String sourceLanguage,
    String narrationLanguage,
    String metadataLanguage,
    String imageAspectRatio,
    String imageQualityTier,
    String ownerId
) {
}
