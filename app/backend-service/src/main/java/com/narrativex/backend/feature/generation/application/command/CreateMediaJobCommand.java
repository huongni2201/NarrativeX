package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateMediaJobCommand(
    UUID projectId,
    UUID chapterId,
    String idempotencyKey,
    String productionMode,
    String aspectRatio,
    String qualityTier,
    BigDecimal maxAuthorizedCost,
    ImageStyle imageStyle,
    String visualGenerationMode,
    String imageProvider,
    String imageGenerationStrategy) {

  public CreateMediaJobCommand(
      UUID projectId,
      UUID chapterId,
      String idempotencyKey,
      String productionMode,
      String aspectRatio,
      String qualityTier,
      BigDecimal maxAuthorizedCost,
      ImageStyle imageStyle) {
    this(
        projectId,
        chapterId,
        idempotencyKey,
        productionMode,
        aspectRatio,
        qualityTier,
        maxAuthorizedCost,
        imageStyle,
        "IMAGE",
        "API",
        null);
  }

  public CreateMediaJobCommand(
      UUID projectId,
      UUID chapterId,
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
