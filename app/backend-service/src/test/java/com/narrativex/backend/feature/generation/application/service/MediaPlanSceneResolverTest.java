package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MediaPlanSceneResolverTest {
  private final MediaPlanSceneResolver resolver =
      new MediaPlanSceneResolver(
          new MotionStrategyResolver(),
          mock(VisualPromptContextRepository.class),
          new VisualPromptComposer(JsonMapper.builder().build()),
          JsonMapper.builder().build());

  @Test
  void includedBeatScopeProducesExactlyOneImagePlanItem() {
    UUID targetBeatId = UUID.randomUUID();
    UUID otherBeatId = UUID.randomUUID();
    var source =
        new MediaPlanningSource(
            List.of(
                new MediaPlanningSource.SceneSnapshot(
                    UUID.randomUUID(),
                    1,
                    "Scene narration",
                    12,
                    List.of(
                        new MediaPlanningSource.BeatSnapshot(
                            targetBeatId,
                            1,
                            "Target beat",
                            MediaPlanningSource.MotionIntent.STILL,
                            "APPROVED",
                            null,
                            null,
                            null,
                            null),
                        new MediaPlanningSource.BeatSnapshot(
                            otherBeatId,
                            2,
                            "Other beat",
                            MediaPlanningSource.MotionIntent.STILL,
                            "NEEDS_REVIEW",
                            null,
                            null,
                            null,
                            null)))));
    var command =
        new CreateMediaPlanCommand(
            UUID.randomUUID(),
            UUID.randomUUID(),
            ProductionMode.LEGACY_IMAGE,
            "16:9",
            "api",
            "image-model",
            PromptSettingsDefaults.settings(),
            Set.of(targetBeatId));

    var result = resolver.resolve(command, source);

    assertThat(result).hasSize(1);
    assertThat(result.getFirst().beats()).hasSize(1);
    assertThat(result.getFirst().beats().getFirst().visualBeatId()).isEqualTo(targetBeatId);
    assertThat(resolver.allSelectedBeatsApproved(command, source)).isTrue();
  }
}
