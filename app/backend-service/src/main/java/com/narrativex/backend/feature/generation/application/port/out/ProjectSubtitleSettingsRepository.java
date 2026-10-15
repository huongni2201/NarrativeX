package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.render.ProjectSubtitleSettings;
import java.util.UUID;

public interface ProjectSubtitleSettingsRepository {
  ProjectSubtitleSettings find(UUID projectId);

  void save(UUID projectId, ProjectSubtitleSettings settings);
}
