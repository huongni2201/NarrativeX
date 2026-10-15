package com.narrativex.backend.feature.character.application.command;

import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import java.util.UUID;

public record CreateCharacterVersionCommand(
    UUID characterId,
    String bible,
    String visualPrompt,
    CharacterVisualProfile visualProfile,
    UUID basedOnVersionId) {
  public CreateCharacterVersionCommand(UUID characterId, String bible, String visualPrompt) {
    this(characterId, bible, visualPrompt, null, null);
  }
}
