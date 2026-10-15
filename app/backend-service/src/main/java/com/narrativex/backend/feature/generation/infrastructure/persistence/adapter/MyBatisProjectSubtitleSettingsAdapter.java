package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProjectSubtitleSettingsRepository;
import com.narrativex.backend.feature.generation.application.render.ProjectSubtitleSettings;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProjectSubtitleSettingsMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
@RequiredArgsConstructor
public class MyBatisProjectSubtitleSettingsAdapter implements ProjectSubtitleSettingsRepository {
  private final ProjectSubtitleSettingsMapper mapper;
  private final ObjectMapper json;

  @Override
  public ProjectSubtitleSettings find(UUID projectId) {
    String stored = mapper.find(projectId);
    return stored == null
        ? ProjectSubtitleSettings.defaults()
        : json.readValue(stored, ProjectSubtitleSettings.class);
  }

  @Override
  public void save(UUID projectId, ProjectSubtitleSettings settings) {
    if (mapper.upsert(projectId, json.writeValueAsString(settings)) != 1) {
      throw new IllegalStateException("Project subtitle settings were not saved");
    }
  }
}
