package com.narrativex.backend.modules.project.infrastructure.persistence;

import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.infrastructure.persistence.entity.ProjectJpaEntity;
import com.narrativex.backend.modules.project.infrastructure.persistence.repository.ProjectJpaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class ProjectPersistenceAdapter implements ProjectRepository {

    private final ProjectJpaRepository repository;

    public ProjectPersistenceAdapter(ProjectJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public List<Project> findActiveByOwnerId(String ownerId) {
        return repository.findByOwnerIdAndArchivedAtIsNullOrderByUpdatedAtDesc(ownerId).stream()
            .map(ProjectPersistenceMapper::toDomain).toList();
    }

    @Override
    public Optional<Project> findOwnedById(Long projectId, String ownerId) {
        return repository.findByIdAndOwnerIdAndArchivedAtIsNull(projectId, ownerId)
            .map(ProjectPersistenceMapper::toDomain);
    }

    @Override
    public Optional<Project> findOwnedByIdForUpdate(Long projectId, String ownerId) {
        return repository.findOwnedByIdForUpdate(projectId, ownerId)
            .map(ProjectPersistenceMapper::toDomain);
    }

    @Override
    public Project save(Project project) {
        ProjectJpaEntity entity = project.getId() == null
            ? new ProjectJpaEntity(project)
            : repository.findById(project.getId()).orElseGet(() -> new ProjectJpaEntity(project));
        entity.apply(project);
        return ProjectPersistenceMapper.toDomain(repository.save(entity));
    }
}
