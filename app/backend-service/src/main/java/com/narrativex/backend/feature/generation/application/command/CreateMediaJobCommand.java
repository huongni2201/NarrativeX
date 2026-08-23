package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.math.BigDecimal;

public record CreateMediaJobCommand(
    Long projectId,
    Long chapterId,
    String idempotencyKey,
    String productionMode,
    String aspectRatio,
    String qualityTier,
    BigDecimal maxAuthorizedCost,
    ImageStyle imageStyle) {
  public CreateMediaJobCommand(
      Long projectId,
      Long chapterId,
      String idempotencyKey,
      String productionMode,
      String aspectRatio,
      String qualityTier,
      BigDecimal maxAuthorizedCost) {
    this(
        projectId,
        chapterId,
        idempotencyKey,
        productionMode,
        aspectRatio,
        qualityTier,
        maxAuthorizedCost,
        ImageStyle.CINEMATIC);
  }
}
