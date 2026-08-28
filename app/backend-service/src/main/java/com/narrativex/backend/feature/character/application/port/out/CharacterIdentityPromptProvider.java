package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;

/** Provides the server-composed final prompt for a project character identity reference. */
public interface CharacterIdentityPromptProvider {
  String promptFor(ProjectCharacterReadModel character);
}
