package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;

public interface ProjectCharacterRepository {
    ProjectCharacter save(ProjectCharacter projectCharacter);
}
