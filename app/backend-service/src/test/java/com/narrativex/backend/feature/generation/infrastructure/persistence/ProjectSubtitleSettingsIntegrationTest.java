package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;

import com.narrativex.backend.feature.generation.application.port.out.ProjectSubtitleSettingsRepository;
import com.narrativex.backend.feature.generation.application.render.ProjectSubtitleSettings;
import com.narrativex.backend.feature.generation.application.render.SubtitleStyle;
import com.narrativex.backend.feature.generation.application.usecase.ProjectSubtitleSettingsUseCase;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ProjectSubtitleSettingsIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired JdbcTemplate jdbc;
  UUID projectId;
  @Autowired ProjectSubtitleSettingsUseCase subtitles;
  @Autowired ProjectSubtitleSettingsRepository settingsRepository;

  @BeforeEach
  void createProject() {
    projectId =
        jdbc.queryForObject(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('subtitle','DRAFT','en', 'en','RATIO_16_9') RETURNING id",
            UUID.class);
  }

  @Test
  void settingsPersistPerProjectWithoutChangingAlreadySavedValues() {
    assertThat(subtitles.get(projectId)).isEqualTo(ProjectSubtitleSettings.defaults());
    UUID other =
        jdbc.queryForObject(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('other','DRAFT','en', 'en','RATIO_16_9') RETURNING id",
            UUID.class);
    var selected =
        new ProjectSubtitleSettings(
            false,
            new SubtitleStyle(
                2,
                "TOP_LEFT",
                "OUTLINE",
                "Verdana",
                700,
                0.05,
                0.1,
                "#FFCC00",
                "#000000",
                "#000000",
                0.4));
    subtitles.save(projectId, selected);
    assertThat(settingsRepository.find(projectId)).isEqualTo(selected);
    assertThat(subtitles.get(other)).isEqualTo(ProjectSubtitleSettings.defaults());
    jdbc.update("UPDATE projects SET status='ARCHIVED' WHERE id=?", projectId);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> subtitles.save(projectId, ProjectSubtitleSettings.defaults()));
    assertThat(settingsRepository.find(projectId)).isEqualTo(selected);
  }
}
