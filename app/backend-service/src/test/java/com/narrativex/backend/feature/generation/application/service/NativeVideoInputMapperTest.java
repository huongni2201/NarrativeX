package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper.NativeCameraIntent;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper.NativeMotionIntent;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NativeVideoInputMapperTest {
  private final NativeVideoInputMapper mapper = new NativeVideoInputMapper();

  @Test
  void mapsCameraDomainJsonToClosedWorkerFields() {
    var shot =
        shot(
            "{\"action\":\"leaps\"}",
            "{\"composition\":\"wide\"}",
            "{\"framing\":\"medium\",\"angle\":\"eye level\",\"lens\":\"35mm\"}",
            "{\"cameraMotion\":\"crane-up\",\"speed\":\"slow\",\"path\":\"ignored\"}",
            "{}");

    var inputs = mapper.map(shot, java.util.List.of(), null);

    assertThat(inputs.cameraIntent())
        .isEqualTo(new NativeCameraIntent("medium", "crane-up", "eye level", "slow"));
  }

  @Test
  void mapsMotionDomainJsonToClosedWorkerFields() {
    var shot =
        shot(
            "{\"action\":\"leaps\",\"dynamics\":\"explosive\",\"extra\":true}",
            "{}",
            "{}",
            "{}",
            "{\"subjectMotion\":\"runs\",\"speed\":\"fast\",\"internal\":{\"trace\":1}}");

    var inputs = mapper.map(shot, java.util.List.of(), null);

    assertThat(inputs.motionIntent())
        .isEqualTo(new NativeMotionIntent("runs", "fast", "explosive"));
  }

  @Test
  void emptyShotJsonProducesNoOptionalIntentObjects() {
    var inputs = mapper.map(shot("{}", "{}", "{}", "{}", "{}"), java.util.List.of(), null);

    assertThat(inputs.cameraIntent()).isNull();
    assertThat(inputs.motionIntent()).isNull();
  }

  private static ShotView shot(
      String action, String composition, String camera, String cameraMotion, String subjectMotion) {
    return new ShotView(
        UUID.randomUUID(),
        0,
        "purpose",
        null,
        "[]",
        null,
        "{}",
        action,
        "{}",
        composition,
        camera,
        subjectMotion,
        cameraMotion,
        "{}",
        4_000,
        GenerationStrategy.TEXT_TO_VIDEO,
        "720p_24fps_standard",
        null,
        null,
        null);
  }
}
