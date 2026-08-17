package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.common.response.ApiResponse;
import com.narrativex.backend.modules.project.api.response.StoryVersionResponse;
import com.narrativex.backend.modules.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.modules.project.domain.aggregate.Project;
import com.narrativex.backend.modules.project.domain.entity.StoryVersion;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateStoryVersionUseCase {
    private final ProjectAccess projectAccess;
    private final StoryVersionRepository storyVersionRepository;
    private final CurrentUserId currentUserId;
    private final NarrativeXLimitsProperties limits;

    public CreateStoryVersionUseCase(ProjectAccess projectAccess, StoryVersionRepository storyVersionRepository,
                                     CurrentUserId currentUserId, NarrativeXLimitsProperties limits) {
        this.projectAccess = projectAccess;
        this.storyVersionRepository = storyVersionRepository;
        this.currentUserId = currentUserId;
        this.limits = limits;
    }

    @Transactional
    public ApiResponse<StoryVersionResponse> execute(CreateStoryVersionCommand command) {
        String resolvedOwnerId = currentUserId.resolve(command.ownerId());
        Project project = projectAccess.findOwnedProjectForUpdate(command.projectId(), resolvedOwnerId);
        int characterCount = command.content().codePointCount(0, command.content().length());
        int estimatedTokens = Math.max(1, (characterCount + 3) / 4);
        if (characterCount > limits.getMaxStoryCharacters()) throw new IllegalArgumentException("Story exceeds the configured Unicode character limit");
        if (estimatedTokens > limits.getMaxEstimatedInputTokens()) throw new IllegalArgumentException("Story exceeds the configured estimated token limit");
        int versionNumber = storyVersionRepository.findMaxVersionNumberByProjectId(command.projectId()) + 1;
        StoryVersion storyVersion = project.createStoryVersion(versionNumber, command.content(),
            defaultValue(command.sourceLanguage(), "vi-VN"), command.rightsAttestationAccepted(),
            defaultValue(command.rightsPolicyVersion(), "rights-v1.7"),
            defaultValue(command.rightsBasis(), "USER_ATTESTED_RIGHTS_OR_LICENSE"), resolvedOwnerId);
        StoryVersion saved = storyVersionRepository.save(storyVersion);
        return ApiResponse.success("Story version created successfully", StoryVersionResponse.from(saved));
    }

    private String defaultValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
