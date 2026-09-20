package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class VideoPromptCompilerTest {

  private VideoPromptCompiler compiler;

  @BeforeEach
  void setUp() {
    compiler = new VideoPromptCompiler(new ObjectMapper());
  }

  @Test
  void compile_buildsStructuredPrompt() {
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Thief infiltration",
            RetentionRole.ESCALATION,
            "[{\"aiName\":\"thief\"}]",
            "castle_courtyard",
            "{\"state\":\"Crouched on rooftop ridge\"}",
            "{\"action\":\"Drops down silently to courtyard paving stones\"}",
            "{\"state\":\"Landed in deep shadow behind pillar\"}",
            "{\"composition\":\"Medium full shot\"}",
            "{\"camera\":\"High angle 35mm lens\"}",
            "{\"subjectMotion\":\"Sudden swift vertical drop and soft roll\"}",
            "{\"cameraMotion\":\"Smooth vertical tilt down following descent\"}",
            "{\"environmentMotion\":\"Windblown rain and distant torch smoke\"}",
            3500L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var compiled =
        compiler.compile(shot, ImageStyle.CINEMATIC_ANIME, "Previous shot was wide establishing");

    assertThat(compiled.prompt()).contains("Drops down silently");
    assertThat(compiled.prompt()).contains("Characters: thief");
    assertThat(compiled.prompt()).contains("castle_courtyard");
    assertThat(compiled.prompt()).contains("Medium full shot, High angle 35mm lens");
    assertThat(compiled.prompt()).contains("Sudden swift vertical drop");
    assertThat(compiled.prompt()).contains("Smooth vertical tilt down");
    assertThat(compiled.prompt()).contains("Windblown rain");
    assertThat(compiled.prompt()).contains("Starts with Crouched on rooftop ridge");
    assertThat(compiled.prompt()).contains("Landed in deep shadow behind pillar");
    assertThat(compiled.prompt()).contains("Previous shot was wide establishing");
    assertThat(compiled.prompt()).contains("CHARACTER RENDERING LANGUAGE");
    assertThat(compiled.negativePrompt()).contains("blurry").contains("morphing");
  }
}
