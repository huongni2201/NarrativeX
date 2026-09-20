package com.narrativex.backend.feature.storyboard.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.storyboard.domain.enums.AttentionEventType;
import com.narrativex.backend.feature.storyboard.application.port.in.HookPlanSpec;
import com.narrativex.backend.feature.storyboard.application.port.in.RetentionMapSpec;
import com.narrativex.backend.feature.storyboard.domain.entity.HookPlan;
import com.narrativex.backend.feature.storyboard.domain.entity.RetentionMap;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RetentionEngineTest {

  private RetentionEngine retentionEngine;

  @BeforeEach
  void setUp() {
    retentionEngine = new RetentionEngine();
  }

  @Test
  void detectPacingRisks_warnsOnNoEventsWithLongDuration() {
    List<String> warnings = retentionEngine.detectPacingRisks(List.of(), 20000L);
    assertThat(warnings).hasSize(1);
    assertThat(warnings.getFirst()).contains("PACING_RISK").contains("No attention events");
  }

  @Test
  void detectPacingRisks_warnsOnOpeningGap() {
    var event =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.VISUAL_CHANGE, 18000L, "Sudden explosion", "HIGH");
    List<String> warnings = retentionEngine.detectPacingRisks(List.of(event), 30000L);
    assertThat(warnings).hasSize(1);
    assertThat(warnings.getFirst()).contains("Opening duration of 18000ms");
  }

  @Test
  void detectPacingRisks_warnsOnIntermediateGap() {
    var event1 =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.QUESTION, 2000L, "Who opened the safe?", "MEDIUM");
    var event2 =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.PAYOFF, 22000L, "The note is revealed", "HIGH");
    List<String> warnings = retentionEngine.detectPacingRisks(List.of(event1, event2), 30000L);
    assertThat(warnings).hasSize(1);
    assertThat(warnings.getFirst()).contains("Prolonged gap of 20000ms");
  }

  @Test
  void detectPacingRisks_noWarningsForWellPacedEvents() {
    var event1 =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.QUESTION, 3000L, "Question 1", "MEDIUM");
    var event2 =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.CONFLICT, 10000L, "Tension rises", "HIGH");
    var event3 =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.PAYOFF, 18000L, "Answer revealed", "HIGH");
    List<String> warnings =
        retentionEngine.detectPacingRisks(List.of(event1, event2, event3), 22000L);
    assertThat(warnings).isEmpty();
  }

  @Test
  void buildHookPlan_createsValidEntity() {
    UUID chapterId = UUID.randomUUID();
    UUID payoffBeatId = UUID.randomUUID();
    var spec =
        new HookPlanSpec(
            "Secrets revealed",
            "Trust vs survival",
            "Who poisoned the tea?",
            "Close-up of bubbling tea cup",
            "Drink, or we all perish",
            "Identity of the poisoner",
            "Climax Reveal");

    HookPlan hookPlan = retentionEngine.buildHookPlan(chapterId, spec, payoffBeatId);

    assertThat(hookPlan.getChapterId()).isEqualTo(chapterId);
    assertThat(hookPlan.getPromise()).isEqualTo("Secrets revealed");
    assertThat(hookPlan.getConflict()).isEqualTo("Trust vs survival");
    assertThat(hookPlan.getCuriosityQuestion()).isEqualTo("Who poisoned the tea?");
    assertThat(hookPlan.getVisualHook()).isEqualTo("Close-up of bubbling tea cup");
    assertThat(hookPlan.getDialogueHook()).isEqualTo("Drink, or we all perish");
    assertThat(hookPlan.getWithheldInformation()).isEqualTo("Identity of the poisoner");
    assertThat(hookPlan.getPayoffBeatId()).isEqualTo(payoffBeatId);
  }

  @Test
  void buildRetentionMap_createsValidEntityWithEventsAndWarnings() {
    UUID chapterId = UUID.randomUUID();
    var event =
        new RetentionMapSpec.AttentionEventSpec(
            AttentionEventType.SOUND_CHANGE, 20000L, "Heartbeat stops", "CRITICAL");
    var spec =
        new RetentionMapSpec(
            List.of(0.2, 0.5, 0.9),
            List.of("Will he make it?"),
            List.of(),
            List.of(event));

    RetentionMap map = retentionEngine.buildRetentionMap(chapterId, spec, 30000L);

    assertThat(map.getChapterId()).isEqualTo(chapterId);
    assertThat(map.getTensionCurveJson()).contains("0.2");
    assertThat(map.getOpenQuestionsJson()).contains("Will he make it?");
    assertThat(map.getAttentionEvents()).isNotEmpty();
    // One original event + one pacing risk event from 20000ms opening gap
    assertThat(map.getAttentionEvents()).hasSize(2);
    assertThat(map.getPacingWarningsJson()).contains("PACING_RISK");
  }
}
