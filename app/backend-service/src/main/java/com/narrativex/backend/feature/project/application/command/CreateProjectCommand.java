package com.narrativex.backend.feature.project.application.command;

public record CreateProjectCommand(
    String name,
    String description,
    String sourceLanguage,
    String narrationLanguage,
    String metadataLanguage,
    String imageAspectRatio,
    String ownerId) {}
