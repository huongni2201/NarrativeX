package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.*;

import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.application.render.SubtitleStyle;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

class ProjectRenderSubtitleIdentityTest {
  private final JsonMapper json =
      JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

  @Test
  void changingOnlySubtitleColorChangesRenderRequestIdentity() {
    var white = command("#FFFFFF");
    var red = command("#FF0000");
    assertThat(CreateProjectRenderUseCase.requestFingerprint(white))
        .isNotEqualTo(CreateProjectRenderUseCase.requestFingerprint(red));
    assertThat(CreateProjectRenderUseCase.requestFingerprint(command("#ff0000")))
        .isEqualTo(CreateProjectRenderUseCase.requestFingerprint(red));
  }

  private CreateProjectRenderCommand command(String color) {
    var style =
        new SubtitleStyle(
            2,
            "BOTTOM_CENTER",
            "DEFAULT",
            "Arial",
            700,
            0.034,
            0.07,
            color,
            "#000000",
            "#000000",
            0.75);
    return json.readValue(
        """
        {"projectId":"00000000-0000-0000-0000-000000000001","resolution":"720p","format":"mp4","idempotencyKey":null,"localDeviceId":"00000000-0000-0000-0000-000000000002","fps":24,"subtitlesEnabled":true,"beatOverrides":[],"subtitleStyle":%s}
        """
            .formatted(style.toJson()),
        CreateProjectRenderCommand.class);
  }
}
