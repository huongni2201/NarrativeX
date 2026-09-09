package com.narrativex.backend.feature.generation.infrastructure.prompt;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.api.response.VisualBeatGeminiContextResponse;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class BackendVisualBeatPromptProviderTest {
  private static final String DIRECTION =
      "{\"shot_size\":\"CLOSE_UP\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":50,"
          + "\"focus_target\":\"Lan's face\",\"action_phase\":\"REACTION\","
          + "\"subject_placement\":\"center frame\",\"foreground\":null,"
          + "\"background\":\"doorway\",\"motivated_light\":\"warm practical\","
          + "\"palette\":\"warm amber\",\"camera_movement\":\"NONE\","
          + "\"movement_direction\":null,\"movement_intensity\":\"SUBTLE\","
          + "\"crop_safe_area\":\"keep face clear\"}";

  @Test
  void storyboardPromptMatchesExactGeminiContextPrompt() {
    var projectId = UUID.fromString("10000000-0000-0000-0000-000000000001");
    var sceneId = UUID.fromString("20000000-0000-0000-0000-000000000001");
    var beatId = UUID.fromString("30000000-0000-0000-0000-000000000001");
    var beat = beat(beatId, sceneId);

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
            beat.getVisualDirectionJson(),
            beatContext);
    var geminiPrompt = VisualBeatGeminiContextResponse.from(beatId, geminiComposed).prompt();

    assertThat(provider.promptFor(projectId, beat)).isEqualTo(geminiPrompt);
  }

  @Test
  void batchPromptCompositionUsesOneBatchContextLookup() {
    var projectId = UUID.randomUUID();
    var sceneId = UUID.randomUUID();
    var first = beat(UUID.randomUUID(), sceneId);
    var second = beat(UUID.randomUUID(), sceneId);
    var context = VisualPromptContext.empty();
    var repository = new CountingContextRepository(context);
    var provider =
        new BackendVisualBeatPromptProvider(
            new VisualPromptComposer(JsonMapper.builder().build()), repository);

    var prompts = provider.promptsFor(projectId, List.of(first, second));

    assertThat(prompts).containsKeys(first.getId(), second.getId());
    assertThat(repository.batchCalls).isEqualTo(1);
    assertThat(repository.singleCalls).isZero();
  }

  private static VisualBeat beat(UUID beatId, UUID sceneId) {
    return VisualBeat.rehydrate(
        beatId,
        0L,
        sceneId,
        0,
        "Doorway beat",
        "Lan pauses in the doorway before entering the room",
        DIRECTION,
        MotionMode.STILL,
        null,
        VisualBeatReviewStatus.NEEDS_REVIEW);
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

  private static final class CountingContextRepository implements VisualPromptContextRepository {
    private final VisualPromptContext context;
    private int batchCalls;
    private int singleCalls;

    private CountingContextRepository(VisualPromptContext context) {
      this.context = context;
    }

    @Override
    public VisualPromptContext findForScene(UUID projectId, UUID sceneId) {
      return context;
    }

    @Override
    public VisualPromptContext findForBeat(UUID projectId, UUID visualBeatId) {
      singleCalls++;
      return context;
    }

    @Override
    public Map<UUID, VisualPromptContext> findForBeats(UUID projectId, List<UUID> visualBeatIds) {
      batchCalls++;
      return visualBeatIds.stream()
          .collect(java.util.stream.Collectors.toMap(id -> id, ignored -> context));
    }
  }
}
