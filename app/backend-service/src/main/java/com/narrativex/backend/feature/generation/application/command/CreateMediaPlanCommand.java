package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.math.BigDecimal;
import java.util.Objects;

/** Internal command for creating one authorized immutable media-plan revision. */
public record CreateMediaPlanCommand(
    Long projectId,
    Long chapterId,
    ProductionMode productionMode,
    BigDecimal estimatedCost,
    String imageAspectRatio,
    String imageQualityTier,
    String imageProviderKey,
    String imageModelKey,
    String pricingSnapshotJson,
    String pricingFingerprint) {
  public CreateMediaPlanCommand(
      Long projectId, Long chapterId, ProductionMode productionMode, BigDecimal estimatedCost) {
    this(
        projectId,
        chapterId,
        productionMode,
        estimatedCost,
        "16:9",
        "STANDARD",
        "vertex",
        "imagen-3.0-generate-002",
        null,
        null);
  }

  public CreateMediaPlanCommand {
    if (projectId == null || projectId <= 0) {
      throw new IllegalArgumentException("projectId must be positive");
    }
    if (chapterId == null || chapterId <= 0) {
      throw new IllegalArgumentException("chapterId must be positive");
    }
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(estimatedCost, "estimatedCost");
    if (estimatedCost.signum() < 0) {
      throw new IllegalArgumentException("estimatedCost must not be negative");
    }
  }
}
