package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.compute.VideoQualityMetricsDto;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView.ProductionTakeQualityItem;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView.ProductionTakeQualityWarningItem;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Assessment;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Context;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Level;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.SceneColor;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.SpeechExpectation;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.ToDoubleFunction;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Reads stored take measurements and evaluates them for the production view. */
@Component
public class TakeQualityReadModel {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final String KEY = "qualityControl";
  private static final String NATIVE_AV = "NATIVE_AV";

  private final TakeQualityEvaluator evaluator;

  public TakeQualityReadModel(TakeQualityEvaluator evaluator) {
    this.evaluator = evaluator;
  }

  /** Measurements saved by the video finalizer; empty for takes that were never measured. */
  public Optional<VideoQualityMetricsDto> storedMetrics(String metricsJson) {
    if (metricsJson == null || metricsJson.isBlank()) {
      return Optional.empty();
    }
    try {
      JsonNode node = JSON.readTree(metricsJson).get(KEY);
      return node == null || !node.isObject()
          ? Optional.empty()
          : Optional.of(JSON.treeToValue(node, VideoQualityMetricsDto.class));
    } catch (RuntimeException ignored) {
      // Metrics are advisory: a malformed or foreign payload must not break the production view.
      return Optional.empty();
    }
  }

  /**
   * Whether this Take was generated with speech, from its frozen input snapshot. A snapshot that
   * predates the {@code inputs.dialogue} field, or cannot be read, is {@code UNKNOWN}: the current
   * cues are deliberately not consulted, since editing them must not re-grade an existing Take.
   */
  public SpeechExpectation speechExpectation(String inputSnapshotJson) {
    if (inputSnapshotJson == null || inputSnapshotJson.isBlank()) {
      return SpeechExpectation.UNKNOWN;
    }
    try {
      JsonNode inputs = JSON.readTree(inputSnapshotJson).get("inputs");
      if (inputs == null || !inputs.isObject()) {
        return SpeechExpectation.UNKNOWN;
      }
      JsonNode dialogue = inputs.get("dialogue");
      if (dialogue == null || !dialogue.isArray()) {
        return SpeechExpectation.UNKNOWN;
      }
      JsonNode audioMode = inputs.get("audioMode");
      if (audioMode != null && audioMode.isString() && !NATIVE_AV.equals(audioMode.asString())) {
        // Speech comes from a separate track, so the video itself is not expected to carry it.
        return SpeechExpectation.NOT_EXPECTED;
      }
      return dialogue.isEmpty() ? SpeechExpectation.NOT_EXPECTED : SpeechExpectation.EXPECTED;
    } catch (RuntimeException ignored) {
      return SpeechExpectation.UNKNOWN;
    }
  }

  public ProductionTakeQualityItem assess(
      String metricsJson,
      Long durationMs,
      SpeechExpectation speech,
      Optional<SceneColor> sceneColor) {
    Optional<VideoQualityMetricsDto> stored = storedMetrics(metricsJson);
    Assessment assessment =
        evaluator.evaluate(
            stored.orElse(null),
            durationMs != null ? durationMs : 0L,
            new Context(speech, sceneColor.orElse(null)));
    List<ProductionTakeQualityWarningItem> warnings =
        assessment.warnings().stream()
            .map(
                warning ->
                    new ProductionTakeQualityWarningItem(
                        warning.code(),
                        warning.category(),
                        warning.severity().name(),
                        warning.measured(),
                        warning.threshold()))
            .toList();
    Level level = assessment.level();
    return new ProductionTakeQualityItem(
        level.name(), assessment.thresholdsVersion(), warnings, stored.orElse(null), speech.name());
  }

  /** Per-channel median color of the given takes; only measured takes with a signature count. */
  public Optional<SceneColor> sceneReference(Collection<VideoQualityMetricsDto> others) {
    List<VideoQualityMetricsDto> usable =
        others.stream()
            .filter(
                m -> m.measured() && m.meanY() != null && m.meanU() != null && m.meanV() != null)
            .toList();
    if (usable.isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(
        new SceneColor(
            median(usable, VideoQualityMetricsDto::meanY),
            median(usable, VideoQualityMetricsDto::meanU),
            median(usable, VideoQualityMetricsDto::meanV)));
  }

  private static double median(
      List<VideoQualityMetricsDto> metrics, ToDoubleFunction<VideoQualityMetricsDto> channel) {
    double[] sorted = metrics.stream().mapToDouble(channel).sorted().toArray();
    int middle = sorted.length / 2;
    return sorted.length % 2 == 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
}
