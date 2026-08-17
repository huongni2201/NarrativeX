package com.narrativex.backend.modules.character.infrastructure.persistence;

import com.narrativex.backend.modules.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.modules.character.domain.model.ProjectCharacter;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.ProjectCharacterJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.repository.ProjectCharacterJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class ProjectCharacterPersistenceAdapter implements ProjectCharacterRepository {
    private final ProjectCharacterJpaRepository repository;

    public ProjectCharacterPersistenceAdapter(ProjectCharacterJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public ProjectCharacter save(ProjectCharacter assignment) {
        ProjectCharacterJpaEntity entity = assignment.getId() == null
            ? new ProjectCharacterJpaEntity(assignment)
            : repository.findById(assignment.getId()).orElseGet(() -> new ProjectCharacterJpaEntity(assignment));
        entity.apply(assignment);
        return CharacterPersistenceMapper.toDomain(repository.save(entity));
    }
}
