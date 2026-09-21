package com.narrativex.backend.feature.storyboard.domain.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.storyboard.domain.enums.AttentionEventType;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RetentionPlanDomainTest {

  @Test
  void hookPlanEncapsulatesOpeningHooks() {
    UUID chapterId = UUID.randomUUID();
    UUID payoffBeatId = UUID.randomUUID();

    HookPlan plan =
        new HookPlan(
            chapterId,
            "A forgotten vault holds the key to the city's power grid",
            "Security droids awaken with lethal protocols",
            "Will Marcus disable the core before the blast doors seal?",
            "Sparks erupt as Marcus slices the control panel with a laser torch",
            "We have forty seconds before the reactor goes critical.",
            "Marcus's true employer remains unidentified",
            payoffBeatId);

    assertThat(plan.getChapterId()).isEqualTo(chapterId);
    assertThat(plan.getPromise()).contains("forgotten vault");
    assertThat(plan.getConflict()).contains("Security droids");
    assertThat(plan.getCuriosityQuestion()).contains("blast doors seal");
    assertThat(plan.getVisualHook()).contains("laser torch");
    assertThat(plan.getDialogueHook()).contains("forty seconds");
    assertThat(plan.getPayoffBeatId()).isEqualTo(payoffBeatId);
  }

  @Test
  void retentionMapTracksAttentionEventsAndTension() {
    UUID chapterId = UUID.randomUUID();
    UUID retentionMapId = UUID.randomUUID();

    AttentionEvent event1 =
        new AttentionEvent(
            retentionMapId,
            AttentionEventType.CONFLICT,
            3000L,
            "Security droids burst into the corridor",
            "CRITICAL");

    AttentionEvent event2 =
        new AttentionEvent(
            retentionMapId,
            AttentionEventType.REACTION,
            5500L,
            "Marcus's face tenses as he sees the laser grid activate",
            "WARNING");

    RetentionMap map =
        new RetentionMap(
            chapterId,
            "[0.4, 0.6, 0.85, 0.95, 0.7]",
            "[\"Who hired Marcus?\", \"What is inside the vault?\"]",
            "[\"Can Marcus bypass the lock?\"]",
            "[]",
            List.of(event1, event2));

    assertThat(map.getChapterId()).isEqualTo(chapterId);
    assertThat(map.getAttentionEvents()).hasSize(2);
    assertThat(map.getAttentionEvents().get(0).getEventType())
        .isEqualTo(AttentionEventType.CONFLICT);
    assertThat(map.getAttentionEvents().get(1).getSeverity()).isEqualTo("WARNING");
  }
}
