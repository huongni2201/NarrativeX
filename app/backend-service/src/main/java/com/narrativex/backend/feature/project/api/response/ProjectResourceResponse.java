package com.narrativex.backend.feature.project.api.response;

import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import java.time.Instant;
import java.util.UUID;

public final class ProjectResourceResponse {
  private ProjectResourceResponse() {}

  public record Location(
      UUID id,
      String name,
      String description,
      String visualPrompt,
      String referenceImageUrl,
      String status,
      Instant updatedAt) {
    public static Location from(ProjectResourceView.Location view) {
      return new Location(
          view.id(),
          view.name(),
          view.description(),
          view.visualPrompt(),
          view.referenceImageUrl(),
          view.status(),
          view.updatedAt());
    }
  }

  public record Asset(
      UUID id,
      String name,
      String assetType,
      String storageKey,
      String url,
      String mimeType,
      String status,
      String metadataJson,
      Instant updatedAt) {
    public static Asset from(ProjectResourceView.Asset view) {
      return new Asset(
          view.id(),
          view.name(),
          view.assetType(),
          view.storageKey(),
          view.url(),
          view.mimeType(),
          view.status(),
          view.metadataJson(),
          view.updatedAt());
    }
  }
}
