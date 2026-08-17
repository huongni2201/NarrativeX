package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.modules.project.application.command.CreateProjectCommand;
import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.aggregate.AspectRatio;
import com.narrativex.backend.modules.project.domain.aggregate.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.aggregate.Project;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateProjectUseCase {

    private final ProjectRepository projectRepository;
    private final CurrentUserId currentUserId;

    public CreateProjectUseCase(ProjectRepository projectRepository, CurrentUserId currentUserId) {
        this.projectRepository = projectRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public Project execute(CreateProjectCommand command, String ownerId) {
        String sourceLanguage = defaultValue(command.sourceLanguage(), "vi-VN");
        String narrationLanguage = defaultValue(command.narrationLanguage(), sourceLanguage);
        String metadataLanguage = defaultValue(command.metadataLanguage(), sourceLanguage);
        AspectRatio ratio = command.imageAspectRatio() == null || command.imageAspectRatio().isBlank()
            ? AspectRatio.RATIO_16_9 : AspectRatio.fromCode(command.imageAspectRatio());
        ImageQualityTier quality = command.imageQualityTier() == null || command.imageQualityTier().isBlank()
            ? ImageQualityTier.STANDARD : ImageQualityTier.valueOf(command.imageQualityTier());
        return projectRepository.save(Project.create(command.name(), currentUserId.resolve(ownerId), sourceLanguage,
            narrationLanguage, metadataLanguage, ratio, quality));
    }

    private String defaultValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
