package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.query.ProjectRenderArtifactView;
import java.util.UUID;

public record ProjectRenderArtifactResponse(
    Long id,
    UUID projectId,
    UUID generationJobId,
    String storageKey,
    String mimeType,
    long sizeBytes,
    String checksumSha256,
    long durationMs,
    int width,
    int height,
    int fps,
    String status) {
  public static ProjectRenderArtifactResponse from(ProjectRenderArtifactView view) {
    return new ProjectRenderArtifactResponse(
        view.id(),
        view.projectId(),
        view.generationJobId(),
        view.storageKey(),
        view.mimeType(),
        view.sizeBytes(),
        view.checksumSha256(),
        view.durationMs(),
        view.width(),
        view.height(),
        view.fps(),
        view.status());
  }
}
