package com.narrativex.backend.feature.render.api.response;

import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import java.time.Instant;

public record FinalArtifactResponse(
    Long id,
    Long projectId,
    Long chapterId,
    String artifactType,
    String renderFingerprint,
    String storageKey,
    String mimeType,
    Long sizeBytes,
    String checksumSha256,
    Long durationMs,
    Integer width,
    Integer height,
    String status,
    Instant createdAt,
    Instant updatedAt,
    boolean downloadAvailable,
    String downloadUrl) {
  public static FinalArtifactResponse from(FinalArtifactView view) {
    boolean downloadAvailable =
        "READY".equalsIgnoreCase(view.status())
            && view.externalFileId() != null
            && !view.externalFileId().isBlank();
    return new FinalArtifactResponse(
        view.id(),
        view.projectId(),
        view.chapterId(),
        view.artifactType(),
        view.renderFingerprint(),
        view.storageKey(),
        view.mimeType(),
        view.sizeBytes(),
        view.checksumSha256(),
        view.durationMs(),
        view.width(),
        view.height(),
        view.status(),
        view.createdAt(),
        view.updatedAt(),
        downloadAvailable,
        downloadAvailable ? "/api/v1/artifacts/" + view.id() + "/download" : null);
  }
}
