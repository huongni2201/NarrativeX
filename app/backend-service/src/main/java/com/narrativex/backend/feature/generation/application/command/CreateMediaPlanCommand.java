package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.math.BigDecimal;
import java.util.Objects;

/** Internal command for creating one authorized immutable media-plan revision. */
public record CreateMediaPlanCommand(
    Long projectId, Long chapterId, ProductionMode productionMode, BigDecimal estimatedCost) {
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
