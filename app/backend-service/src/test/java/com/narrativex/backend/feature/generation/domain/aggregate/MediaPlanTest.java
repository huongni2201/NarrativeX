package com.narrativex.backend.feature.generation.domain.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.MediaBeatPlan;
import com.narrativex.backend.feature.generation.domain.value.MediaScenePlan;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MediaPlanTest {

  @Test
  void defensivelyCopiesSceneAndBeatLists() {
    var beats =
        new ArrayList<>(
            List.of(
                new MediaBeatPlan(
                    11L, 0, "Character enters", "AI_VIDEO", MotionStrategy.IMAGE_TO_VIDEO)));
    var scenes = new ArrayList<>(List.of(new MediaScenePlan(7L, 0, "Narration", 5, beats)));

    var plan =
        MediaPlan.create(
            3L,
            4L,
            "abc123",
            ProductionMode.HYBRID_LOCAL_I2V,
            1,
            scenes,
            new MediaWorkload(9, 1, 0, 0, 5),
            BigDecimal.ONE,
            Instant.parse("2026-08-20T00:00:00Z"));

    scenes.clear();
    beats.clear();

    assertThat(plan.scenes()).hasSize(1);
    assertThat(plan.scenes().getFirst().beats()).hasSize(1);
    assertThatThrownBy(() -> plan.scenes().clear())
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
