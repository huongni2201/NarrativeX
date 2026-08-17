package com.narrativex.backend.modules.project.infrastructure.persistence.adapter;

import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.aggregate.Project;
import com.narrativex.backend.modules.project.infrastructure.persistence.entity.ProjectJpaEntity;
import com.narrativex.backend.modules.project.infrastructure.persistence.repository.ProjectJpaRepository;
import com.narrativex.backend.modules.project.infrastructure.persistence.mapper.ProjectPersistenceMapper;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

@Component
public class ProjectPersistenceAdapter implements ProjectRepository {

    private final ProjectJpaRepository repository;

    public ProjectPersistenceAdapter(ProjectJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public Page<Project> findActiveByOwnerId(String ownerId, Pageable pageable) {
        return repository.findByOwnerIdAndArchivedAtIsNullOrderByUpdatedAtDesc(ownerId, pageable)
            .map(ProjectPersistenceMapper::toDomain);
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
