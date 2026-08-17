package com.narrativex.backend.modules.project.application.port.out;

import com.narrativex.backend.modules.project.domain.aggregate.StoryVersion;

public interface StoryVersionRepository {
    int findMaxVersionNumberByProjectId(Long projectId);
    StoryVersion save(StoryVersion storyVersion);
}
