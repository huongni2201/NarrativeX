package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import java.util.Optional;
import java.util.UUID;

public interface ProjectCharacterRepository {
  Optional<ProjectCharacter> findByProjectAndCharacterForUpdate(UUID projectId, UUID characterId);

  ProjectCharacter save(ProjectCharacter projectCharacter);
}
