package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.response.ProjectResponse;
import com.narrativex.backend.feature.project.application.command.CreateProjectCommand;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
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
  public ApiResponse<ProjectResponse> execute(CreateProjectCommand command) {
    String sourceLanguage = defaultValue(command.sourceLanguage(), "vi-VN");
    String narrationLanguage = defaultValue(command.narrationLanguage(), sourceLanguage);
    String metadataLanguage = defaultValue(command.metadataLanguage(), sourceLanguage);
    AspectRatio ratio =
        command.imageAspectRatio() == null || command.imageAspectRatio().isBlank()
            ? AspectRatio.RATIO_16_9
            : AspectRatio.fromCode(command.imageAspectRatio());
    ImageQualityTier quality =
        command.imageQualityTier() == null || command.imageQualityTier().isBlank()
            ? ImageQualityTier.STANDARD
            : ImageQualityTier.valueOf(command.imageQualityTier());
    Project project =
        projectRepository.save(
            Project.create(
                command.name(),
                currentUserId.get(),
                sourceLanguage,
                narrationLanguage,
                metadataLanguage,
                ratio,
                quality));
    return ApiResponse.success("Project created successfully", ProjectResponse.from(project));
  }

  private String defaultValue(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }
}
