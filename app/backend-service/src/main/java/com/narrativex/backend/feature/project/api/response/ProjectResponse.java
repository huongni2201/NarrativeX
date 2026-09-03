package com.narrativex.backend.feature.project.api.response;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.UUID;

public record ProjectResponse(
    UUID id,
    String name,
    String description,
    String coverImageUrl,
    String status,
    String sourceLanguage,
    String narrationLanguage,
    String metadataLanguage,
    String imageAspectRatio,
    long rowVersion) {
  public static ProjectResponse from(Project project) {
    return new ProjectResponse(
        project.getId(),
        project.getName(),
        project.getDescription(),
        project.getCoverImageUrl(),
        project.getStatus().name(),
        project.getSourceLanguage(),
        project.getNarrationLanguage(),
        project.getMetadataLanguage(),
        project.getImageAspectRatio().getCode(),
        project.getRowVersion());
  }
}
