package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.feature.generation.application.port.out.ProjectSubtitleSettingsRepository;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.application.render.ProjectSubtitleSettings;
import com.narrativex.backend.feature.generation.application.render.SubtitleStyle;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.MyBatisProjectRenderInputSnapshotAdapter;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProjectRenderInputSnapshotMapper;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ProjectSubtitleSnapshotTest {
  @Test
  void admissionFreezesProjectStyleAndLaterEditsCannotAlterTheSnapshot() {
    var selected =
        new SubtitleStyle(
            2,
            "TOP_RIGHT",
            "SHADOW",
            "Georgia",
            400,
            0.05,
            0.1,
            "#FFCC00",
            "#000000",
            "#000000",
            0.75);
    var settings = new AtomicReference<>(new ProjectSubtitleSettings(true, selected));
    ProjectSubtitleSettingsRepository repository =
        new ProjectSubtitleSettingsRepository() {
          public ProjectSubtitleSettings find(UUID id) {
            return settings.get();
          }

          public void save(UUID id, ProjectSubtitleSettings value) {
            settings.set(value);
          }
        };
    var mapper = mock(ProjectRenderInputSnapshotMapper.class);
    var captured = new AtomicReference<String>();
    when(mapper.insertHeader(
            any(), any(), anyString(), anyString(), any(), anyInt(), anyInt(), anyString()))
        .thenAnswer(
            call -> {
              captured.set(call.getArgument(7));
              return 1;
            });
    var adapter = new MyBatisProjectRenderInputSnapshotAdapter(mapper, repository);
    var timeline =
        new ProductionTimelineView(UUID.randomUUID(), null, 0, "16:9", true, List.of(), List.of());
    adapter.create(UUID.randomUUID(), timeline, "1080p", "mp4", UUID.randomUUID(), 24, true, false);
    repository.save(timeline.projectId(), ProjectSubtitleSettings.defaults());
    var snapshot = JsonMapper.builder().build().readTree(captured.get());
    assertThat(snapshot.path("subtitles").path("style").path("fontFamily").asString())
        .isEqualTo("Georgia");
    assertThat(snapshot.path("subtitles").path("style").path("position").asString())
        .isEqualTo("TOP_RIGHT");
    assertThat(snapshot.path("subtitles").path("style").path("fontWeight").asInt()).isEqualTo(400);
    assertThat(repository.find(timeline.projectId())).isEqualTo(ProjectSubtitleSettings.defaults());
    adapter.create(
        UUID.randomUUID(), timeline, "1080p", "mp4", UUID.randomUUID(), 24, true, false, selected);
    var explicitSnapshot = JsonMapper.builder().build().readTree(captured.get());
    assertThat(explicitSnapshot.path("subtitles").path("style").path("fontFamily").asString())
        .isEqualTo("Georgia");
    assertThat(explicitSnapshot.path("subtitles").path("style").path("primaryColor").asString())
        .isEqualTo("#FFCC00");
  }
}
