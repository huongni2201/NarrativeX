package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.command.CreateProjectCommand;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateProjectUseCase {
  private final ProjectRepository projectRepository;
  private final CurrentUserId currentUserId;

  @Transactional
  public Project execute(CreateProjectCommand command) {
    String ownerId = currentUserId.get();
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
                command.description(),
                ownerId,
                sourceLanguage,
                narrationLanguage,
                metadataLanguage,
                ratio,
                quality));
    log.info(
        "Created project id={} (name='{}', ownerId={}, sourceLanguage={})",
        project.getId(),
        project.getName(),
        ownerId,
        sourceLanguage);
    return project;
  }

  private static String defaultValue(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }
}
