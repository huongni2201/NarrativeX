package com.narrativex.backend.modules.project.infrastructure.persistence.adapter;

import com.narrativex.backend.modules.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.modules.project.domain.entity.StoryVersion;
import com.narrativex.backend.modules.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import com.narrativex.backend.modules.project.infrastructure.persistence.mapper.ProjectPersistenceMapper;
import com.narrativex.backend.modules.project.infrastructure.persistence.repository.StoryVersionJpaRepository;
import org.springframework.stereotype.Component;

@Component
public class StoryVersionPersistenceAdapter implements StoryVersionRepository {
    private final StoryVersionJpaRepository repository;
    public StoryVersionPersistenceAdapter(StoryVersionJpaRepository repository) { this.repository = repository; }
    @Override public int findMaxVersionNumberByProjectId(Long projectId) { return repository.findMaxVersionNumberByProjectId(projectId); }
    @Override public StoryVersion save(StoryVersion storyVersion) {
        StoryVersionJpaEntity entity = storyVersion.getId() == null ? new StoryVersionJpaEntity(storyVersion)
            : repository.findById(storyVersion.getId()).orElseGet(() -> new StoryVersionJpaEntity(storyVersion));
        entity.apply(storyVersion);
        return ProjectPersistenceMapper.toDomain(repository.save(entity));
    }
}
