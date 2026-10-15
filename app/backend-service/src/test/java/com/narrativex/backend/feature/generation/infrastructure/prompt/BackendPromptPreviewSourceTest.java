package com.narrativex.backend.feature.generation.infrastructure.prompt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.usecase.GetProjectCharacterDetailUseCase;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewTarget;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.CharacterIdentityPromptComposer;
import com.narrativex.backend.feature.generation.application.service.StoryboardVisualPromptComposer;
import com.narrativex.backend.feature.generation.application.service.VideoPromptCompiler;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.application.service.VisualPromptText;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardBeatAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class BackendPromptPreviewSourceTest {
  private static final String DIRECTION =
      "{\"shot_size\":\"CLOSE_UP\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":50,"
          + "\"focus_target\":\"Lan's face\",\"action_phase\":\"REACTION\","
          + "\"subject_placement\":\"center frame\",\"foreground\":null,"
          + "\"background\":\"doorway\",\"motivated_light\":\"warm practical\","
          + "\"palette\":\"warm amber\",\"camera_movement\":\"NONE\","
          + "\"movement_direction\":null,\"movement_intensity\":\"SUBTLE\","
          + "\"crop_safe_area\":\"keep face clear\"}";

  private final UUID projectId = UUID.randomUUID();
  private final UUID chapterId = UUID.randomUUID();
  private final UUID beatId = UUID.randomUUID();
  private final UUID shotId = UUID.randomUUID();
  private final StoryboardBeatAccess beats = mock(StoryboardBeatAccess.class);
  private final StoryboardShotAccess shots = mock(StoryboardShotAccess.class);
  private final VisualPromptContextRepository contexts = mock(VisualPromptContextRepository.class);
  private final BackendPromptPreviewSource source =
      new BackendPromptPreviewSource(
          mock(GetProjectCharacterDetailUseCase.class),
          new CharacterIdentityPromptComposer(),
          beats,
          contexts,
          new StoryboardVisualPromptComposer(new VisualPromptComposer(JsonMapper.builder().build())),
          shots,
          new VideoPromptCompiler(JsonMapper.builder().build()));

  private PromptSettings style(String id) {
    return PromptSettingsDefaults.settings().withActiveStyle(id).withRevision(1);
  }

  private VisualBeat beat() {
    return VisualBeat.rehydrate(
        beatId,
        0L,
        UUID.randomUUID(),
        0,
        "Doorway beat",
        "Lan pauses in the doorway before entering the room",
        DIRECTION,
        MotionMode.STILL,
        null,
        VisualBeatReviewStatus.NEEDS_REVIEW);
  }

  @Test
  void visualBeatPreviewUsesTheComposerOfTheSelectedSettingsAndMatchesAdmission() {
    when(beats.requireCurrentBeats(projectId, chapterId)).thenReturn(List.of(beat()));
    when(contexts.findForBeat(projectId, beatId)).thenReturn(VisualPromptContext.empty());
    var target = new PromptPreviewTarget.VisualBeat(projectId, chapterId, beatId);

    var anime = source.preview(style("CINEMATIC_ANIME"), target);
    var watercolor = source.preview(style("STORYBOOK_WATERCOLOR"), target);

    assertThat(anime.prompt()).contains("premium semi-realistic 3D CGI");
    assertThat(watercolor.prompt()).containsIgnoringCase("storybook watercolor");
    assertThat(watercolor.prompt()).doesNotContain("premium semi-realistic");
    assertThat(anime.negativePrompt()).isNotEqualTo(watercolor.negativePrompt());
    // finalText is exactly what the image provider receives (prompt plus AVOID line).
    assertThat(anime.finalText())
        .isEqualTo(VisualPromptText.finalPrompt(anime.prompt(), anime.negativePrompt()));
  }

  @Test
  void visualBeatPreviewOfAnUnknownBeatIsNotFound() {
    when(beats.requireCurrentBeats(projectId, chapterId)).thenReturn(List.of());

    assertThatThrownBy(
            () ->
                source.preview(
                    style("CINEMATIC"),
                    new PromptPreviewTarget.VisualBeat(projectId, chapterId, beatId)))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void shotPreviewAppliesTheVideoInstructionAndNegativeOfTheSelectedSettings() {
    when(shots.findShotById(projectId, shotId)).thenReturn(Optional.of(shot()));
    var target = new PromptPreviewTarget.Shot(projectId, shotId);
    var custom =
        PromptSettingsDefaults.settings().withRevision(2);
    custom =
        new PromptSettings(
            custom.formatVersion(),
            custom.revision(),
            custom.activeStyleId(),
            custom.styles(),
            new com.narrativex.backend.feature.generation.application.model.prompt
                .PromptInstructions(
                custom.instructions().chapterAnalysis(),
                custom.instructions().characterReference(),
                custom.instructions().storyboard(),
                "Keep camera moves slow and weighty."),
            "banned-negative-token");

    var withCustom = source.preview(custom, target);
    var withDefaults = source.preview(style("CINEMATIC_ANIME"), target);

    assertThat(withCustom.prompt()).contains("Keep camera moves slow and weighty.");
    assertThat(withDefaults.prompt()).doesNotContain("Keep camera moves slow and weighty.");
    assertThat(withCustom.negativePrompt()).contains("banned-negative-token");
    assertThat(withDefaults.negativePrompt()).contains("watermark");
  }

  @Test
  void shotPreviewOfAnUnknownShotIsNotFound() {
    when(shots.findShotById(projectId, shotId)).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                source.preview(
                    style("CINEMATIC"), new PromptPreviewTarget.Shot(projectId, shotId)))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  private StoryboardShotAccess.ShotView shot() {
    return new StoryboardShotAccess.ShotView(
        shotId,
        0,
        "Hero moves",
        null,
        "[]",
        null,
        "{}",
        "{\"action\":\"Hero moves\"}",
        "{}",
        "{\"composition\":\"wide\"}",
        "{\"camera\":\"eye level\"}",
        "{\"subjectMotion\":\"moves\"}",
        "{\"cameraMotion\":\"slow track\"}",
        "{}",
        4000,
        GenerationStrategy.TEXT_TO_VIDEO,
        "720p_24fps_standard",
        null,
        null,
        null);
  }
}
