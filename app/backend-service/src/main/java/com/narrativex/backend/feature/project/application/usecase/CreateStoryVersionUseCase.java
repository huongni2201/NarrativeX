package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.response.StoryVersionResponse;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateStoryVersionUseCase {
  private final ProjectAccess projectAccess;
  private final StoryVersionRepository storyVersionRepository;
  private final CurrentUserId currentUserId;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public ApiResponse<StoryVersionResponse> execute(CreateStoryVersionCommand command) {
    String resolvedOwnerId = currentUserId.get();
    Project project = projectAccess.findOwnedProjectForUpdate(command.projectId(), resolvedOwnerId);
    int characterCount = command.content().codePointCount(0, command.content().length());
    int estimatedTokens = Math.max(1, (characterCount + 3) / 4);
    if (characterCount > limits.getMaxStoryCharacters())
      throw new IllegalArgumentException("Story exceeds the configured Unicode character limit");
    if (estimatedTokens > limits.getMaxEstimatedInputTokens())
      throw new IllegalArgumentException("Story exceeds the configured estimated token limit");
    int versionNumber =
        storyVersionRepository.findMaxVersionNumberByProjectId(command.projectId()) + 1;
    StoryVersion storyVersion =
        project.createStoryVersion(
            versionNumber,
            command.content(),
            defaultValue(command.sourceLanguage(), "vi-VN"));
    StoryVersion saved = storyVersionRepository.save(storyVersion);
    return ApiResponse.success(
        "Story version created successfully", StoryVersionResponse.from(saved));
  }

  private String defaultValue(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }
}
