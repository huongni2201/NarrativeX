package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class GenerationRouterTest {

  private GenerationRouter router;

  @BeforeEach
  void setUp() {
    ReferencePlanner planner = new ReferencePlanner();
    VideoPromptCompiler compiler = new VideoPromptCompiler(new ObjectMapper());
    router = new GenerationRouter(planner, compiler);
  }

  @Test
  void route_generatesReadyPlanWhenPrerequisitesMet() {
    UUID heroAssetId = UUID.randomUUID();
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Hero prepares",
            RetentionRole.ESCALATION,
            "[{\"aiName\":\"hero\"}]",
            "armory",
            "{\"state\":\"Unsheathing blade\"}",
            "{\"action\":\"Raises sword to inspection level\"}",
            "{\"state\":\"Blade reflecting torchlight\"}",
            "{\"composition\":\"Close-up\"}",
            "{\"camera\":\"Eye-level 50mm\"}",
            "{\"subjectMotion\":\"Slow deliberate lift\"}",
            "{\"cameraMotion\":\"Static\"}",
            "{\"environmentMotion\":\"Flickering torchlight\"}",
            3000L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var plan =
        router.route(
            shot,
            ImageStyle.CINEMATIC_ANIME,
            Map.of("hero", heroAssetId),
            Map.of(),
            Map.of(),
            null,
            null);

    assertThat(plan.readyForAdmission()).isTrue();
    assertThat(plan.strategy()).isEqualTo(GenerationStrategy.IMAGE_TO_VIDEO);
    assertThat(plan.references()).hasSize(1);
    assertThat(plan.compiledPrompt().prompt()).contains("Raises sword to inspection level");
    assertThat(plan.blockingPreflightReasons()).isEmpty();
  }

  @Test
  void route_blocksWhenMissingPrerequisites() {
    ShotView shot =
        new ShotView(
            UUID.randomUUID(),
            0,
            "Hero prepares",
            RetentionRole.ESCALATION,
            "[{\"aiName\":\"hero\"}]",
            "armory",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            3000L,
            GenerationStrategy.IMAGE_TO_VIDEO,
            "720p_24fps_standard",
            null,
            null,
            ShotStatus.PLANNED);

    var plan = router.route(shot, ImageStyle.CINEMATIC_ANIME, Map.of(), Map.of(), Map.of(), null, null);

    assertThat(plan.readyForAdmission()).isFalse();
    assertThat(plan.blockingPreflightReasons()).isNotEmpty();
    assertThat(plan.blockingPreflightReasons().getFirst()).contains("Missing approved CHARACTER_REFERENCE");
  }
}
