package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.domain.enums.AttentionEventType;
import com.narrativex.backend.feature.storyboard.application.port.in.HookPlanSpec;
import com.narrativex.backend.feature.storyboard.application.port.in.RetentionMapSpec;
import com.narrativex.backend.feature.storyboard.domain.entity.AttentionEvent;
import com.narrativex.backend.feature.storyboard.domain.entity.HookPlan;
import com.narrativex.backend.feature.storyboard.domain.entity.RetentionMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Evaluates viewer retention structures, pacing risks, and constructs retention aggregates. */
@Service
public class RetentionEngine {
  public static final long DEFAULT_PACING_RISK_THRESHOLD_MS = 15000L;

  /** Evaluates pacing and returns detected pacing risk warnings. */
  public List<String> detectPacingRisks(
      List<RetentionMapSpec.AttentionEventSpec> events, long totalDurationMs) {
    List<String> warnings = new ArrayList<>();
    if (events == null || events.isEmpty()) {
      if (totalDurationMs > DEFAULT_PACING_RISK_THRESHOLD_MS) {
        warnings.add(
            "PACING_RISK: No attention events detected across entire duration ("
                + totalDurationMs
                + "ms).");
      }
      return warnings;
    }

    List<RetentionMapSpec.AttentionEventSpec> sorted =
        events.stream()
            .sorted(Comparator.comparingLong(RetentionMapSpec.AttentionEventSpec::timeOffsetMs))
            .toList();

    // Check opening gap
    if (sorted.getFirst().timeOffsetMs() > DEFAULT_PACING_RISK_THRESHOLD_MS) {
      warnings.add(
          "PACING_RISK: Opening duration of "
              + sorted.getFirst().timeOffsetMs()
              + "ms has no attention events prior to first event.");
    }

    // Check gaps between events
    for (int i = 0; i < sorted.size() - 1; i++) {
      long gap = sorted.get(i + 1).timeOffsetMs() - sorted.get(i).timeOffsetMs();
      if (gap > DEFAULT_PACING_RISK_THRESHOLD_MS) {
        warnings.add(
            "PACING_RISK: Prolonged gap of "
                + gap
                + "ms between event at "
                + sorted.get(i).timeOffsetMs()
                + "ms and "
                + sorted.get(i + 1).timeOffsetMs()
                + "ms without sensory or narrative progression.");
      }
    }

    return warnings;
  }

  /** Constructs a validated HookPlan domain entity from specification. */
  public HookPlan buildHookPlan(UUID chapterId, HookPlanSpec spec, UUID payoffBeatId) {
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    Objects.requireNonNull(spec, "spec must not be null");
    return new HookPlan(
        chapterId,
        spec.promise(),
        spec.conflict(),
        spec.curiosityQuestion(),
        spec.visualHook(),
        spec.dialogueHook(),
        spec.withheldInformation(),
        payoffBeatId);
  }

  /** Constructs a validated RetentionMap domain entity from specification. */
  public RetentionMap buildRetentionMap(
      UUID chapterId, RetentionMapSpec spec, long totalDurationMs) {
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    Objects.requireNonNull(spec, "spec must not be null");

    UUID retentionMapId = UUID.randomUUID();
    List<String> pacingWarnings = detectPacingRisks(spec.attentionEvents(), totalDurationMs);

    List<AttentionEvent> domainEvents = new ArrayList<>();
    if (spec.attentionEvents() != null) {
      for (var eventSpec : spec.attentionEvents()) {
        domainEvents.add(
            new AttentionEvent(
                retentionMapId,
                eventSpec.eventType(),
                eventSpec.timeOffsetMs(),
                eventSpec.description(),
                eventSpec.severity()));
      }
    }

    // Add generated pacing warnings as PACING_RISK attention events
    for (String warning : pacingWarnings) {
      domainEvents.add(
          new AttentionEvent(
              retentionMapId, AttentionEventType.PACING_RISK, 0L, warning, "WARNING"));
    }

    String tensionJson = spec.tensionCurve() != null ? spec.tensionCurve().toString() : "[]";
    String openQJson = spec.openQuestions() != null ? spec.openQuestions().toString() : "[]";
    String resQJson =
        spec.resolvedQuestions() != null ? spec.resolvedQuestions().toString() : "[]";
    String warningsJson = pacingWarnings.toString();

    return new RetentionMap(
        retentionMapId, 0L, chapterId, tensionJson, openQJson, resQJson, warningsJson, domainEvents);
  }
}
