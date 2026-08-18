package com.narrativex.backend.feature.project.api.response;

import com.narrativex.backend.feature.project.domain.aggregate.Project;

public record ProjectResponse(
    Long id,
    String name,
    String status,
    String sourceLanguage,
    String narrationLanguage,
    String metadataLanguage,
    String imageAspectRatio,
    String imageQualityTier,
    long rowVersion) {
  public static ProjectResponse from(Project project) {
    return new ProjectResponse(
        project.getId(),
        project.getName(),
        project.getStatus().name(),
        project.getSourceLanguage(),
        project.getNarrationLanguage(),
        project.getMetadataLanguage(),
        project.getImageAspectRatio().getCode(),
        project.getImageQualityTier().name(),
        project.getRowVersion());
  }
}
