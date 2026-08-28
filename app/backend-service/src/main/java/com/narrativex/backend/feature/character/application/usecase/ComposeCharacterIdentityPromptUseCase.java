package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.port.out.CharacterIdentityPromptProvider;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Inbound application surface for deriving the final character identity generation prompt. */
@Service
@RequiredArgsConstructor
public class ComposeCharacterIdentityPromptUseCase {
  private final CharacterIdentityPromptProvider characterIdentityPromptProvider;

  public String execute(ProjectCharacterReadModel character) {
    return characterIdentityPromptProvider.promptFor(character);
  }
}
