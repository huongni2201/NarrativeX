package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper;
import com.narrativex.backend.feature.generation.application.service.VideoPromptCompiler;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ChapterAnalysisDefaultShotInputTest {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  @Test
  void defaultShotKeepsBeatDirectionInPromptAndNativeCameraIntent() {
    var direction =
        JSON.readTree(
            """
            {
              "shot_size": "MEDIUM",
              "camera_angle": "LOW",
              "lens_mm": 50,
              "focus_target": "the hero",
              "action_phase": "END",
              "subject_placement": "left third",
              "foreground": "wet railing",
              "background": "city street",
              "motivated_light": "sunset from camera right",
              "palette": "cool blue",
              "camera_movement": "PAN",
              "movement_direction": "LEFT",
              "movement_intensity": "MEDIUM",
              "crop_safe_area": "center"
            }
            """);
    var mapped =
        ChapterAnalysisArtifactMaterializer.defaultShotInputs("Hero crosses the room", direction);
    var shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Default shot",
            null,
            "[]",
            null,
            "{}",
            mapped.actionJson(),
            "{}",
            mapped.compositionJson(),
            mapped.cameraJson(),
            "{}",
            mapped.cameraMotionJson(),
            mapped.environmentMotionJson(),
            5_000,
            GenerationStrategy.TEXT_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    String prompt =
        new VideoPromptCompiler(JSON)
            .compile(
                shot,
                (com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings)
                    null,
                null)
            .prompt();
    var nativeInputs = new NativeVideoInputMapper().map(shot, List.of(), null);

    assertThat(prompt)
        .contains("Hero crosses the room Action phase: END")
        .contains("MEDIUM, subject placement: left third, focus: the hero")
        .contains("LOW, 50mm lens")
        .contains("Camera movement: PAN LEFT")
        .contains("Atmosphere: city street, motivated light: sunset from camera right");
    assertThat(nativeInputs.cameraIntent().framing()).isEqualTo("MEDIUM");
    assertThat(nativeInputs.cameraIntent().movement()).isEqualTo("PAN");
    assertThat(nativeInputs.cameraIntent().angle()).isEqualTo("LOW");
    assertThat(nativeInputs.cameraIntent().speed()).isEqualTo("MEDIUM");
  }
}
