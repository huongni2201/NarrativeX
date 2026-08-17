package com.narrativex.backend.modules.project.repository;

import com.narrativex.backend.modules.project.domain.StoryVersion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoryVersionRepository extends JpaRepository<StoryVersion, Long> {
    int countByProjectId(Long projectId);
}
