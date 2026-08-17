package com.narrativex.backend.modules.project.infrastructure.persistence;

import com.narrativex.backend.modules.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.modules.project.domain.model.StoryVersion;
import com.narrativex.backend.modules.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import com.narrativex.backend.modules.project.infrastructure.persistence.repository.StoryVersionJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class StoryVersionPersistenceAdapter implements StoryVersionRepository {

    private final StoryVersionJpaRepository repository;

    public StoryVersionPersistenceAdapter(StoryVersionJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public int countByProjectId(Long projectId) {
        return repository.countByProjectId(projectId);
    }

    @Override
    public StoryVersion save(StoryVersion storyVersion) {
        StoryVersionJpaEntity entity = storyVersion.getId() == null
            ? new StoryVersionJpaEntity(storyVersion)
            : repository.findById(storyVersion.getId()).orElseGet(() -> new StoryVersionJpaEntity(storyVersion));
        entity.apply(storyVersion);
        return ProjectPersistenceMapper.toDomain(repository.save(entity));
    }
}
