package com.narrativex.backend.modules.project.application;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.modules.project.api.CreateProjectRequest;
import com.narrativex.backend.modules.project.api.CreateStoryVersionRequest;
import com.narrativex.backend.modules.project.domain.AspectRatio;
import com.narrativex.backend.modules.project.domain.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.Project;
import com.narrativex.backend.modules.project.domain.StoryVersion;
import com.narrativex.backend.modules.project.repository.ProjectRepository;
import com.narrativex.backend.modules.project.repository.StoryVersionRepository;
import com.narrativex.backend.shared.security.CurrentUserId;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectApplicationService {

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
    public Project createProject(CreateProjectRequest request, String ownerId) {
        String sourceLanguage = defaultValue(request.sourceLanguage(), "vi-VN");
        String narrationLanguage = defaultValue(request.narrationLanguage(), sourceLanguage);
        String metadataLanguage = defaultValue(request.metadataLanguage(), sourceLanguage);
        AspectRatio ratio = request.imageAspectRatio() == null || request.imageAspectRatio().isBlank()
            ? AspectRatio.RATIO_16_9 : AspectRatio.fromCode(request.imageAspectRatio());
        ImageQualityTier quality = request.imageQualityTier() == null || request.imageQualityTier().isBlank()
            ? ImageQualityTier.STANDARD : ImageQualityTier.valueOf(request.imageQualityTier());
        return projectRepository.save(new Project(request.name(), resolveOwner(ownerId), sourceLanguage,
            narrationLanguage, metadataLanguage, ratio, quality));
    }

    @Transactional
    public StoryVersion createStory(Long projectId, CreateStoryVersionRequest request, String ownerId) {
        Project project = projectRepository.findByIdAndOwnerIdAndArchivedAtIsNull(projectId, resolveOwner(ownerId))
            .orElseThrow(() -> new IllegalArgumentException("Project not found or not owned by caller"));
        int characterCount = request.content().codePointCount(0, request.content().length());
        int estimatedTokens = Math.max(1, (characterCount + 3) / 4);
        if (characterCount > limits.getMaxStoryCharacters()) {
            throw new IllegalArgumentException("Story exceeds the configured Unicode character limit");
        }
        if (estimatedTokens > limits.getMaxEstimatedInputTokens()) {
            throw new IllegalArgumentException("Story exceeds the configured estimated token limit");
        }
        int versionNumber = storyVersionRepository.countByProjectId(projectId) + 1;
        return storyVersionRepository.save(new StoryVersion(project, versionNumber, request.content(),
            request.sourceLanguage() == null || request.sourceLanguage().isBlank() ? "vi-VN" : request.sourceLanguage(),
            request.rightsAttestationAccepted(),
            defaultValue(request.rightsPolicyVersion(), "rights-v1.7"),
            defaultValue(request.rightsBasis(), "USER_ATTESTED_RIGHTS_OR_LICENSE"),
            resolveOwner(ownerId)));
    }

    private String resolveOwner(String ownerId) {
        return currentUserId.resolve(ownerId);
    }

    private String defaultValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
