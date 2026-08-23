package com.narrativex.backend.feature.project.application.query;

import java.time.Instant;
import java.util.UUID;

public final class ProjectResourceView {
  private ProjectResourceView() {}

  public record Location(
      UUID id,
      String name,
      String description,
      String visualPrompt,
      String referenceImageUrl,
      String status,
      Instant updatedAt) {}

  public record Asset(
      UUID id,
      String name,
      String assetType,
      String storageKey,
      String url,
      String mimeType,
      String status,
      String metadataJson,
      Instant updatedAt) {}
}
