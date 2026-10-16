package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository.ShotLocationContext;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
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

  private ShotView shotAt(String locationRef, String action) {
    return new ShotView(
        UUID.randomUUID(),
        0,
        "Court scene",
        RetentionRole.ESCALATION,
        "[{\"aiName\":\"king\"}]",
        locationRef,
        "{}",
        "{\"action\":\"" + action + "\"}",
        "{}",
        "{\"composition\":\"Medium shot\"}",
        "{}",
        "{}",
        "{}",
        "{}",
        3500L,
        GenerationStrategy.TEXT_TO_VIDEO,
        "720p_24fps_standard",
        null,
        null,
        ShotStatus.PLANNED);
  }

  private VideoLocationContext hall(UUID previousShotId, String previousEnd) {
    return VideoLocationContext.from(
        new ShotLocationContext(
            new LocationCanon(
                UUID.randomUUID(),
                "Main Hall",
                null,
                "Wide hall, throne on a dais, two rows of red pillars"),
            previousShotId,
            previousEnd));
  }

  @Test
  void shotsOfTheSameSceneCarryAnIdenticalSettingSection() {
    var locationFirst = hall(null, null);
    var locationSecond = hall(UUID.randomUUID(), "{\"state\":\"King rises\"}");

    var first =
        compiler.compile(
            shotAt("hall_a", "King enters"), (PromptSettings) null, null, locationFirst);
    var second =
        compiler.compile(
            shotAt("a totally different ref", "King speaks"),
            (PromptSettings) null,
            null,
            locationSecond);

    String setting = "Setting: Main Hall: Wide hall, throne on a dais, two rows of red pillars. ";
    assertThat(first.prompt()).contains(setting);
    assertThat(second.prompt()).contains(setting);
  }

  @Test
  void resolvedLocationReplacesTheFreeTextLocationRef() {
    var compiled =
        compiler.compile(
            shotAt("hall_a", "King enters"), (PromptSettings) null, null, hall(null, null));

    assertThat(compiled.prompt()).doesNotContain("hall_a").doesNotContain("Location:");
    assertThat(compiled.subjectDescription()).isEqualTo("Characters: king");
  }

  @Test
  void withoutAResolvedLocationTheLocationRefStillFeedsThePrompt() {
    var compiled =
        compiler.compile(shotAt("hall_a", "King enters"), (PromptSettings) null, null, null);

    assertThat(compiled.prompt()).contains("Location: hall_a").doesNotContain("Setting:");
  }

  @Test
  void fourArgumentCompileWithoutLocationMatchesTheThreeArgumentOverload() {
    var shot = shotAt("hall_a", "King enters");

    assertThat(compiler.compile(shot, (PromptSettings) null, "Prev wide", null))
        .isEqualTo(compiler.compile(shot, (PromptSettings) null, "Prev wide"));
  }

  @Test
  void sameSceneContinuityFollowsThePreviousShotAndMergesWithExplicitContinuity() {
    var location = hall(UUID.randomUUID(), "{\"state\":\"King rises\"}");

    var compiled =
        compiler.compile(shotAt(null, "King speaks"), (PromptSettings) null, "Prev wide", location);

    assertThat(compiled.prompt())
        .contains(
            "Continuity: Prev wide; same location (Main Hall) as the previous shot, keep"
                + " architecture, prop layout, lighting and time of day unchanged; previous shot"
                + " ended with King rises.");
  }

  @Test
  void firstShotOfASceneHasNoLocationContinuity() {
    var compiled =
        compiler.compile(
            shotAt(null, "King enters"), (PromptSettings) null, null, hall(null, null));

    assertThat(compiled.prompt()).contains("Setting: Main Hall").doesNotContain("Continuity:");
  }

  @Test
  void compileIsDeterministic() {
    var shot = shotAt(null, "King enters");
    var location = hall(UUID.randomUUID(), "{\"state\":\"King rises\"}");

    assertThat(compiler.compile(shot, (PromptSettings) null, null, location).prompt())
        .isEqualTo(compiler.compile(shot, (PromptSettings) null, null, location).prompt());
  }
}
