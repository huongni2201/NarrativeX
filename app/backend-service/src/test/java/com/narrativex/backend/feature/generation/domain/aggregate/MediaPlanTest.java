package com.narrativex.backend.feature.generation.domain.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.MediaBeatPlan;
import com.narrativex.backend.feature.generation.domain.value.MediaScenePlan;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaPlanTest {

  @Test
  void defensivelyCopiesSceneAndBeatLists() {
    UUID beatId = UuidV7.random();
    UUID sceneId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    var beats =
        new ArrayList<MediaBeatPlan>(
            List.of(
                new MediaBeatPlan(
                    beatId,
                    0,
                    "Character enters",
                    "AI_VIDEO",
                    MotionStrategy.BASIC_IMAGE_MOTION,
                    "GENERATE_NEW",
                    "prompt-v1",
                    "Character enters",
                    null,
                    null,
                    null,
                    null,
                    "NONE",
                    "{}",
                    "{}",
                    null,
                    null)));
    var scenes =
        new ArrayList<MediaScenePlan>(
            List.of(new MediaScenePlan(sceneId, 0, "Narration", 5, beats)));

    var plan =
        MediaPlan.createExecutable(
            chapterId,
            4L,
            "abc123",
            ProductionMode.IMAGE_MOTION,
            1,
            scenes,
            new MediaWorkload(9, 1, 0, 0, 5),
            Instant.parse("2026-08-20T00:00:00Z"),
            null,
            "16:9",
            "vertex",
            "gemini-2.5-flash-image",
            null,
            null);

    scenes.clear();
    beats.clear();

    assertThat(plan.scenes()).hasSize(1);
    assertThat(plan.scenes().getFirst().beats()).hasSize(1);
    assertThatThrownBy(() -> plan.scenes().clear())
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
