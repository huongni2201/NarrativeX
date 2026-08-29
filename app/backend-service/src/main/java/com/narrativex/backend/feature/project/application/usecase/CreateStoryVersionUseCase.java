package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.exception.StoryCharacterLimitExceededException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateStoryVersionUseCase {
  private final ProjectAccess projectAccess;
  private final StoryVersionRepository storyVersionRepository;
  private final CurrentUserId currentUserId;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public StoryVersion execute(CreateStoryVersionCommand command) {
    String resolvedOwnerId = currentUserId.get();
    Project project = projectAccess.findOwnedProjectForUpdate(command.projectId(), resolvedOwnerId);
    int characterCount = command.content().codePointCount(0, command.content().length());
    if (characterCount > limits.getMaxStoryCharacters()) {
      throw new StoryCharacterLimitExceededException(
          characterCount, limits.getMaxStoryCharacters());
    }
    int versionNumber =
        storyVersionRepository.findMaxVersionNumberByProjectId(command.projectId()) + 1;
    StoryVersion storyVersion =
        project.createStoryVersion(
            versionNumber, command.content(), defaultValue(command.sourceLanguage(), "vi-VN"));
    StoryVersion saved = storyVersionRepository.save(storyVersion);
    log.info(
        "Created story version id={} (versionNumber={}) for projectId={}",
        saved.getId(),
        saved.getVersionNumber(),
        command.projectId());
    return saved;
  }

  private static String defaultValue(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }
}
