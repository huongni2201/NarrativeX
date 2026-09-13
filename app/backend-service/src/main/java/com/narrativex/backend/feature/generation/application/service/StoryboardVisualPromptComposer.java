package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Canonical Storyboard Visual Beat prompt path shared by preview and provider snapshots.
 *
 * <p>Story-owned scene direction is sanitized exactly once here before the authoritative prompt
 * composer adds canon, continuity and reference locks. Callers must not independently sanitize or
 * wrap the resulting prompt.
 */
@Component
@RequiredArgsConstructor
public final class StoryboardVisualPromptComposer {
  private final VisualPromptComposer visualPromptComposer;

  public ComposedVisualPrompt compose(
      String visualIntent,
      String visualDirectionJson,
      String aspectRatio,
      VisualPromptContext context) {
    String safeVisualIntent = VisualPromptSafety.sanitizeSceneDirection(visualIntent);
    return visualPromptComposer.compose(
        ImageStyle.CINEMATIC_ANIME,
        safeVisualIntent,
        visualDirectionJson,
        aspectRatio,
        context);
  }
}
