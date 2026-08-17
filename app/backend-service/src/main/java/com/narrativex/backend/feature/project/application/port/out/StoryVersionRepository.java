package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;

public interface StoryVersionRepository {
    int findMaxVersionNumberByProjectId(Long projectId);
    StoryVersion save(StoryVersion storyVersion);
}
