package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Internal command for creating one authorized immutable media-plan revision. */
public record CreateMediaPlanCommand(
    UUID projectId,
    UUID chapterId,
    ProductionMode productionMode,
    String imageAspectRatio,
    String imageProviderKey,
    String imageModelKey,
    ImageStyle imageStyle,
    Set<UUID> includedBeatIds) {

  public CreateMediaPlanCommand(
      UUID projectId,
      UUID chapterId,
      ProductionMode productionMode,
      String imageAspectRatio,
      String imageProviderKey,
      String imageModelKey,
      ImageStyle imageStyle) {
    this(
        projectId,
        chapterId,
        productionMode,
        imageAspectRatio,
        imageProviderKey,
        imageModelKey,
        imageStyle,
        Set.of());
  }

  public CreateMediaPlanCommand {
    Objects.requireNonNull(projectId, "projectId");
    Objects.requireNonNull(chapterId, "chapterId");
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(imageStyle, "imageStyle");
    includedBeatIds = includedBeatIds == null ? Set.of() : Set.copyOf(includedBeatIds);
  }
}
