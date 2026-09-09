package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.UUID;

public record CreateMediaJobCommand(
    UUID projectId,
    UUID chapterId,
    String idempotencyKey,
    String productionMode,
    String aspectRatio,
    ImageStyle imageStyle,
    String visualGenerationMode,
    String imageProvider) {

  public CreateMediaJobCommand(
      UUID projectId,
      UUID chapterId,
      String idempotencyKey,
      String productionMode,
      String aspectRatio,
      ImageStyle imageStyle) {
    this(
        projectId,
        chapterId,
        idempotencyKey,
        productionMode,
        aspectRatio,
        imageStyle,
        "IMAGE",
        "API");
  }

  public CreateMediaJobCommand(
      UUID projectId,
      UUID chapterId,
      String idempotencyKey,
      String productionMode,
      String aspectRatio) {
    this(projectId, chapterId, idempotencyKey, productionMode, aspectRatio, ImageStyle.CINEMATIC);
  }
}
