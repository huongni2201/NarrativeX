package com.narrativex.backend.feature.generation.infrastructure.prompt;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.api.response.VisualBeatGeminiContextResponse;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraAngle;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class BackendVisualBeatPromptProviderTest {
  @Test
  void storyboardPromptMatchesExactGeminiContextPrompt() {
    var projectId = UUID.fromString("10000000-0000-0000-0000-000000000001");
    var sceneId = UUID.fromString("20000000-0000-0000-0000-000000000001");
    var beatId = UUID.fromString("30000000-0000-0000-0000-000000000001");
    var beat =
        VisualBeat.rehydrate(
            beatId,
            0L,
            sceneId,
            0,
            "Doorway beat",
            "Lan pauses in the doorway before entering the room",
            MotionMode.STILL,
            CameraMovement.NONE,
            CameraAngle.CLOSE_UP,
            null,
            null,
            VisualBeatReviewStatus.NEEDS_REVIEW);

    var sceneContext =
        new VisualPromptContext(
            new LocationCanon(UUID.randomUUID(), "Wrong scene context", null, "flat office light"),
            List.of());
    var beatContext =
        new VisualPromptContext(
            new LocationCanon(UUID.randomUUID(), "Beat doorway", null, "warm practical backlight"),
            List.of());
    var repository = new StubContextRepository(sceneContext, beatContext);
    var composer = new VisualPromptComposer(JsonMapper.builder().build());
    var provider = new BackendVisualBeatPromptProvider(composer, repository);

    var geminiComposed =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            beat.getVisualIntent(),
            beat.getCameraAngle().name(),
            beatContext);
    var geminiPrompt = VisualBeatGeminiContextResponse.from(beatId, geminiComposed).prompt();

    assertThat(provider.promptFor(projectId, beat)).isEqualTo(geminiPrompt);
  }

  private record StubContextRepository(
      VisualPromptContext sceneContext, VisualPromptContext beatContext)
      implements VisualPromptContextRepository {
    @Override
    public VisualPromptContext findForScene(UUID projectId, UUID sceneId) {
      return sceneContext;
    }

    @Override
    public VisualPromptContext findForBeat(UUID projectId, UUID visualBeatId) {
      return beatContext;
    }
  }
}
