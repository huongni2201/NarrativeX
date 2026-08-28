package com.narrativex.backend.feature.generation.infrastructure.prompt;

import com.narrativex.backend.feature.character.application.port.out.CharacterIdentityPromptProvider;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.generation.application.service.CharacterIdentityPromptComposer;
import com.narrativex.backend.feature.generation.application.service.VisualPromptText;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Bridges character reads to the authoritative backend image prompt style. */
@Component
@RequiredArgsConstructor
public class BackendCharacterIdentityPromptProvider implements CharacterIdentityPromptProvider {
  private final CharacterIdentityPromptComposer characterIdentityPromptComposer;

  @Override
  public String promptFor(ProjectCharacterReadModel character) {
    if (character == null || character.version() == null) {
      throw new IllegalArgumentException("character version must not be null");
    }
    var version = character.version();
    var appearance = character.appearance();
    var composedPrompt =
        characterIdentityPromptComposer.compose(
            ImageStyle.CINEMATIC_ANIME,
            character.canonicalName(),
            version.visualPrompt(),
            version.bible(),
            appearance == null ? null : appearance.appearancePrompt(),
            appearance == null ? null : appearance.ageState(),
            appearance == null ? null : appearance.hairstyle(),
            appearance == null ? null : appearance.injury());
    return VisualPromptText.finalPrompt(composedPrompt.prompt(), composedPrompt.negativePrompt());
  }
}
