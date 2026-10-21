package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.compute.VideoQualityMetricsDto;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView.ProductionTakeQualityItem;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView.ProductionTakeQualityWarningItem;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Assessment;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Context;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Level;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.SceneColor;
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

  public ProductionTakeQualityItem assess(
      String metricsJson, Long durationMs, boolean expectsSpeech, Optional<SceneColor> sceneColor) {
    Optional<VideoQualityMetricsDto> stored = storedMetrics(metricsJson);
    Assessment assessment =
        evaluator.evaluate(
            stored.orElse(null),
            durationMs != null ? durationMs : 0L,
            new Context(expectsSpeech, sceneColor.orElse(null)));
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
        level.name(), assessment.thresholdsVersion(), warnings, stored.orElse(null));
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
