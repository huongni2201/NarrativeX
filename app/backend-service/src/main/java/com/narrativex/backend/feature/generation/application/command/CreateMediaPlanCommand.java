package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Internal command for creating one authorized immutable media-plan revision. {@code
 * promptSettings} is the configuration the caller resolved once at admission; the plan freezes the
 * prompts compiled from it.
 */
public record CreateMediaPlanCommand(
    UUID projectId,
    UUID chapterId,
    ProductionMode productionMode,
    String imageAspectRatio,
    String imageProviderKey,
    String imageModelKey,
    PromptSettings promptSettings,
    Set<UUID> includedBeatIds) {

  public CreateMediaPlanCommand(
      UUID projectId,
      UUID chapterId,
      ProductionMode productionMode,
      String imageAspectRatio,
      String imageProviderKey,
      String imageModelKey,
      PromptSettings promptSettings) {
    this(
        projectId,
        chapterId,
        productionMode,
        imageAspectRatio,
        imageProviderKey,
        imageModelKey,
        promptSettings,
        Set.of());
  }

  /** Built-in preset for the legacy style enum; used by callers that predate Settings → Prompt. */
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
        PromptSettingsDefaults.settingsFor(Objects.requireNonNull(imageStyle, "imageStyle")),
        Set.of());
  }

  public CreateMediaPlanCommand {
    Objects.requireNonNull(projectId, "projectId");
    Objects.requireNonNull(chapterId, "chapterId");
    Objects.requireNonNull(productionMode, "productionMode");
    Objects.requireNonNull(promptSettings, "promptSettings");
    includedBeatIds = includedBeatIds == null ? Set.of() : Set.copyOf(includedBeatIds);
  }
}
