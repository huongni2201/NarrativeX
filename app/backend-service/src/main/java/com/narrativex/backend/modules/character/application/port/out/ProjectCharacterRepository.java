package com.narrativex.backend.modules.character.application.port.out;

import com.narrativex.backend.modules.character.domain.aggregate.ProjectCharacter;

public interface ProjectCharacterRepository {
    ProjectCharacter save(ProjectCharacter projectCharacter);
}
