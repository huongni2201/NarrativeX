package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.BeatSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.SceneSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VisualAssetReuseResolverTest {
  private static final String SHARED_INTENT =
      "Lan stands beside the old wooden desk holding the sealed letter, warm window light from the left, medium framing, the desk and letter remain dominant, restrained worried posture, same beige cardigan and evening apartment continuity";

  @Test
  void reusesAnEquivalentBeatWithoutAnotherPaidGeneration() {
    var source = beat(UUID.randomUUID(), 0, SHARED_INTENT, "MEDIUM");
    var reused = beat(UUID.randomUUID(), 1, SHARED_INTENT, "MEDIUM");

    var decision = VisualAssetReuseResolver.resolve(source, reused);

    assertThat(decision.assetStrategy()).isEqualTo(VisualAssetReuseResolver.REUSE_APPROVED);
    assertThat(decision.sourceVisualBeatId()).isEqualTo(source.visualBeatId());
  }

  @Test
  void reframesEquivalentContentWhenOnlyTheCameraAngleChanges() {
    var source = beat(UUID.randomUUID(), 0, SHARED_INTENT, "MEDIUM");
    var reframed = beat(UUID.randomUUID(), 1, SHARED_INTENT, "CLOSE_UP");

    var decision = VisualAssetReuseResolver.resolve(source, reframed);

    assertThat(decision.assetStrategy()).isEqualTo(VisualAssetReuseResolver.REFRAME_DERIVED);
    assertThat(decision.sourceVisualBeatId()).isEqualTo(source.visualBeatId());
  }

  @Test
  void generatedImageCountExcludesSafeReuseButKeepsNewStoryStates() {
    var first = beat(UUID.randomUUID(), 0, SHARED_INTENT, "MEDIUM");
    var reused = beat(UUID.randomUUID(), 1, SHARED_INTENT, "MEDIUM");
    var changed =
        beat(
            UUID.randomUUID(),
            2,
            "Lan runs outside into heavy rain while the apartment disappears behind her and a taxi stops at the curb",
            "WIDE");
    var scene =
        new SceneSnapshot(UUID.randomUUID(), 0, "Narration", 30, List.of(first, reused, changed));

    assertThat(VisualAssetReuseResolver.countGenerated(List.of(scene))).isEqualTo(2);
  }

  @Test
  void geminiWebAlwaysGeneratesEveryBeat() {
    var first = beat(UUID.randomUUID(), 0, SHARED_INTENT, "MEDIUM");
    var equivalent = beat(UUID.randomUUID(), 1, SHARED_INTENT, "MEDIUM");
    var scene = new SceneSnapshot(UUID.randomUUID(), 0, "Narration", 20, List.of(first, equivalent));

    var plan =
        VisualAssetReuseResolver.plan(
            List.of(scene), "GEMINI_WEB", VisualAssetReuseResolver.GENERATE_NEW);

    assertThat(plan.values())
        .allMatch(decision -> VisualAssetReuseResolver.GENERATE_NEW.equals(decision.assetStrategy()));
    assertThat(plan.values()).allMatch(decision -> decision.sourceVisualBeatId() == null);
  }

  @Test
  void geminiWebRejectsReuseAndReframeStrategies() {
    assertThatThrownBy(
            () ->
                VisualAssetReuseResolver.normalizeStrategy(
                    "GEMINI_WEB", VisualAssetReuseResolver.REUSE_APPROVED))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("only supports GENERATE_NEW");

    assertThatThrownBy(
            () ->
                VisualAssetReuseResolver.normalizeStrategy(
                    "GEMINI_WEB", VisualAssetReuseResolver.REFRAME_DERIVED))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("only supports GENERATE_NEW");
  }

  @Test
  void apiRequestedReuseFallsBackToGenerateNewWhenNoReusableSourceExists() {
    var first = beat(UUID.randomUUID(), 0, SHARED_INTENT, "MEDIUM");
    var changed =
        beat(
            UUID.randomUUID(),
            1,
            "A helicopter crosses a frozen mountain valley as rescue workers descend toward a crashed aircraft",
            "WIDE");
    var scene = new SceneSnapshot(UUID.randomUUID(), 0, "Narration", 20, List.of(first, changed));

    var plan =
        VisualAssetReuseResolver.plan(
            List.of(scene), "API", VisualAssetReuseResolver.REUSE_APPROVED);

    assertThat(plan.get(first.visualBeatId()).assetStrategy())
        .isEqualTo(VisualAssetReuseResolver.GENERATE_NEW);
    assertThat(plan.get(changed.visualBeatId()).assetStrategy())
        .isEqualTo(VisualAssetReuseResolver.GENERATE_NEW);
  }

  @Test
  void apiRequestedReuseUsesApprovedEquivalentSource() {
    var first = beat(UUID.randomUUID(), 0, SHARED_INTENT, "MEDIUM");
    var equivalent = beat(UUID.randomUUID(), 1, SHARED_INTENT, "MEDIUM");
    var scene = new SceneSnapshot(UUID.randomUUID(), 0, "Narration", 20, List.of(first, equivalent));

    var plan =
        VisualAssetReuseResolver.plan(
            List.of(scene), "API", VisualAssetReuseResolver.REUSE_APPROVED);

    assertThat(plan.get(first.visualBeatId()).assetStrategy())
        .isEqualTo(VisualAssetReuseResolver.GENERATE_NEW);
    assertThat(plan.get(equivalent.visualBeatId()).assetStrategy())
        .isEqualTo(VisualAssetReuseResolver.REUSE_APPROVED);
    assertThat(plan.get(equivalent.visualBeatId()).sourceVisualBeatId())
        .isEqualTo(first.visualBeatId());
  }

  @Test
  void oneHourPlanTargetsAboutHalfPaidImagesWhenAdjacentStatesRemainReusable() {
    List<BeatSnapshot> beats = new ArrayList<>();
    for (int index = 0; index < 300; index++) {
      String intent =
          "Lan waits apartment window evening letter desk silence "
              + "detail"
              + index
              + " gesture"
              + index
              + " mood"
              + index
              + " framing"
              + index
              + " moment"
              + index;
      beats.add(
          beat(
              UUID.randomUUID(), index, intent, "MEDIUM", index * 12_000L, (index + 1L) * 12_000L));
    }
    var scene = new SceneSnapshot(UUID.randomUUID(), 0, "Long narration", 3_600, beats);

    assertThat(VisualAssetReuseResolver.targetGenerationRatio(List.of(scene))).isEqualTo(0.50d);
    assertThat(VisualAssetReuseResolver.countGenerated(List.of(scene))).isBetween(145, 160);
  }

  @Test
  void reuseBudgetNeverForcesAnUnrelatedStoryStateToReuse() {
    List<BeatSnapshot> beats = new ArrayList<>();
    for (int index = 0; index < 12; index++) {
      beats.add(
          beat(
              UUID.randomUUID(),
              index,
              "Lan waits apartment window evening letter desk silence detail"
                  + index
                  + " gesture"
                  + index
                  + " mood"
                  + index
                  + " framing"
                  + index
                  + " moment"
                  + index,
              "MEDIUM"));
    }
    var unrelated =
        beat(
            UUID.randomUUID(),
            12,
            "A helicopter crosses a frozen mountain valley as rescue workers descend toward a crashed aircraft",
            "WIDE");
    beats.add(unrelated);
    var scene = new SceneSnapshot(UUID.randomUUID(), 0, "Narration", 1_800, beats);

    var plan = VisualAssetReuseResolver.plan(List.of(scene));

    assertThat(plan.get(unrelated.visualBeatId()).assetStrategy())
        .isEqualTo(VisualAssetReuseResolver.GENERATE_NEW);
  }

  private static BeatSnapshot beat(UUID id, int order, String intent, String cameraAngle) {
    return beat(id, order, intent, cameraAngle, null, null);
  }

  private static BeatSnapshot beat(
      UUID id, int order, String intent, String cameraAngle, Long audioStartMs, Long audioEndMs) {
    return new BeatSnapshot(
        id,
        order,
        intent,
        MotionIntent.STILL,
        "APPROVED",
        "NONE",
        cameraAngle,
        null,
        null,
        audioStartMs,
        audioEndMs);
  }
}
