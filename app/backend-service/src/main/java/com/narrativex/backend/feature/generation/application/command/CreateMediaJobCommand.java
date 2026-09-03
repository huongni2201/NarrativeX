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
    BigDecimal maxAuthorizedCost,
    ImageStyle imageStyle,
    String visualGenerationMode,
    String imageProvider) {

  public CreateMediaJobCommand(
      UUID projectId,
      UUID chapterId,
      String idempotencyKey,
      String productionMode,
      String aspectRatio,
      BigDecimal maxAuthorizedCost,
      ImageStyle imageStyle) {
    this(
        projectId,
        chapterId,
        idempotencyKey,
        productionMode,
        aspectRatio,
        maxAuthorizedCost,
        imageStyle,
        "IMAGE",
        "API");
  }

  public CreateMediaJobCommand(
      UUID projectId,
      UUID chapterId,
      String idempotencyKey,
      String productionMode,
      String aspectRatio,
      BigDecimal maxAuthorizedCost) {
    this(
        projectId,
        chapterId,
        idempotencyKey,
        productionMode,
        aspectRatio,
        maxAuthorizedCost,
        ImageStyle.CINEMATIC);
  }
}
