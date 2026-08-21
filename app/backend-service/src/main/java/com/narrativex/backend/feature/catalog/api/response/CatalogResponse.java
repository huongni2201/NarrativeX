package com.narrativex.backend.feature.catalog.api.response;

import com.narrativex.backend.feature.catalog.application.query.StylePresetView;
import com.narrativex.backend.feature.catalog.application.query.VoiceView;
import java.time.Instant;
import java.util.List;

public final class CatalogResponse {
  private CatalogResponse() {}

  public record StylePreset(
      String name,
      String description,
      String thumbnail,
      List<String> tags) {
    public static StylePreset from(StylePresetView view) {
      return new StylePreset(
          view.name(),
          view.description(),
          view.thumbnailUrl(),
          view.tags());
    }
  }

  public record Voice(
      String id,
      String provider,
      String name,
      String language,
      String gender,
      String sampleUrl,
      String metadataJson,
      Instant updatedAt) {
    public static Voice from(VoiceView view) {
      return new Voice(
          view.id(),
          view.provider(),
          view.name(),
          view.language(),
          view.gender(),
          view.sampleUrl(),
          view.metadataJson(),
          view.updatedAt());
    }
  }
}
