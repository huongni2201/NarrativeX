package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.generation.application.port.out.ProjectSubtitleSettingsRepository;
import com.narrativex.backend.feature.generation.application.render.ProjectSubtitleSettings;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectSubtitleSettingsUseCase {
  private final ProjectAccess projectAccess;
  private final ProjectSubtitleSettingsRepository repository;

  @Transactional(readOnly = true)
  public ProjectSubtitleSettings get(UUID projectId) {
    projectAccess.findProject(projectId);
    return repository.find(projectId);
  }

  @Transactional
  public ProjectSubtitleSettings save(UUID projectId, ProjectSubtitleSettings settings) {
    projectAccess.requireEditableProjectForUpdate(projectId);
    repository.save(projectId, settings);
    return settings;
  }
}
