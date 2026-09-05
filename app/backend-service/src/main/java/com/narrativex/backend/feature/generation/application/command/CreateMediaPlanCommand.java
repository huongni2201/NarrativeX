package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Internal command for creating one authorized immutable media-plan revision. */
public record CreateMediaPlanCommand(
    UUID projectId,
    UUID chapterId,
    ProductionMode productionMode,
    BigDecimal estimatedCost,
    String imageAspectRatio,
    String imageProviderKey,
    String imageModelKey,
    String pricingSnapshotJson,
    String pricingFingerprint,
    ImageStyle imageStyle,
    Set<UUID> includedBeatIds) {

  public CreateMediaPlanCommand(
      UUID projectId,
      UUID chapterId,
      ProductionMode productionMode,
      BigDecimal estimatedCost,
      String imageAspectRatio,
      String imageProviderKey,
      String imageModelKey,
      String pricingSnapshotJson,
      String pricingFingerprint,
      ImageStyle imageStyle) {
    this(
        projectId,
        chapterId,
        productionMode,
        estimatedCost,
        imageAspectRatio,
        imageProviderKey,
        imageModelKey,
        pricingSnapshotJson,
        pricingFingerprint,
        imageStyle,
        Set.of());
  }

  public CreateMediaPlanCommand {
    Objects.requireNonNull(projectId, "projectId");
    Objects.requireNonNull(chapterId, "chapterId");
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(imageStyle, "imageStyle");
    Objects.requireNonNull(estimatedCost, "estimatedCost");
    if (estimatedCost.signum() < 0) {
      throw new IllegalArgumentException("estimatedCost must not be negative");
    }
    includedBeatIds = includedBeatIds == null ? Set.of() : Set.copyOf(includedBeatIds);
  }
}
