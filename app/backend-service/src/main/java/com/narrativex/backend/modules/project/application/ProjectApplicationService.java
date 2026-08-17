package com.narrativex.backend.modules.project.application;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.modules.project.domain.AspectRatio;
import com.narrativex.backend.modules.project.domain.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.Project;
import com.narrativex.backend.modules.project.domain.StoryVersion;
import com.narrativex.backend.modules.project.repository.ProjectRepository;
import com.narrativex.backend.modules.project.repository.StoryVersionRepository;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectApplicationService implements ProjectAccess {

  private final ProjectRepository projectRepository;
  private final StoryVersionRepository storyVersionRepository;
  private final CurrentUserId currentUserId;
  private final NarrativeXLimitsProperties limits;

  public ProjectApplicationService(ProjectRepository projectRepository, StoryVersionRepository storyVersionRepository,
                                   CurrentUserId currentUserId, NarrativeXLimitsProperties limits) {
    this.projectRepository = projectRepository;
    this.storyVersionRepository = storyVersionRepository;
    this.currentUserId = currentUserId;
    this.limits = limits;
  }

  @Transactional(readOnly = true)
  public List<Project> listProjects(String ownerId) {
    return projectRepository.findByOwnerIdAndArchivedAtIsNullOrderByUpdatedAtDesc(resolveOwner(ownerId));
  }

  @Transactional
  public Project createProject(CreateProjectCommand command, String ownerId) {
    String sourceLanguage = defaultValue(command.sourceLanguage(), "vi-VN");
    String narrationLanguage = defaultValue(command.narrationLanguage(), sourceLanguage);
    String metadataLanguage = defaultValue(command.metadataLanguage(), sourceLanguage);
    AspectRatio ratio = command.imageAspectRatio() == null || command.imageAspectRatio().isBlank()
        ? AspectRatio.RATIO_16_9 : AspectRatio.fromCode(command.imageAspectRatio());
    ImageQualityTier quality = command.imageQualityTier() == null || command.imageQualityTier().isBlank()
        ? ImageQualityTier.STANDARD : ImageQualityTier.valueOf(command.imageQualityTier());
    return projectRepository.save(new Project(command.name(), resolveOwner(ownerId), sourceLanguage,
        narrationLanguage, metadataLanguage, ratio, quality));
  }

  @Transactional
  public StoryVersion createStory(Long projectId, CreateStoryVersionCommand command, String ownerId) {
    Project project = findOwnedProject(projectId, ownerId);
    int characterCount = command.content().codePointCount(0, command.content().length());
    int estimatedTokens = Math.max(1, (characterCount + 3) / 4);
    if (characterCount > limits.getMaxStoryCharacters()) {
      throw new IllegalArgumentException("Story exceeds the configured Unicode character limit");
    }
    if (estimatedTokens > limits.getMaxEstimatedInputTokens()) {
      throw new IllegalArgumentException("Story exceeds the configured estimated token limit");
    }
    int versionNumber = storyVersionRepository.countByProjectId(projectId) + 1;
    return storyVersionRepository.save(new StoryVersion(project, versionNumber, command.content(),
        command.sourceLanguage() == null || command.sourceLanguage().isBlank() ? "vi-VN" : command.sourceLanguage(),
        command.rightsAttestationAccepted(),
        defaultValue(command.rightsPolicyVersion(), "rights-v1.7"),
        defaultValue(command.rightsBasis(), "USER_ATTESTED_RIGHTS_OR_LICENSE"),
        resolveOwner(ownerId)));
  }

  @Override
  @Transactional(readOnly = true)
  public Project findOwnedProject(Long projectId, String ownerId) {
    return projectRepository.findByIdAndOwnerIdAndArchivedAtIsNull(projectId, resolveOwner(ownerId))
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

  private String resolveOwner(String ownerId) {
    return currentUserId.resolve(ownerId);
  }

  private String defaultValue(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }
}
