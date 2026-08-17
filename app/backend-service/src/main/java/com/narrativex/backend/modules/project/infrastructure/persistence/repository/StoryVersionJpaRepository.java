package com.narrativex.backend.modules.project.infrastructure.persistence.repository;

import com.narrativex.backend.modules.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoryVersionJpaRepository extends JpaRepository<StoryVersionJpaEntity, Long> {
    int countByProjectId(Long projectId);
}
