package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.model.compute.VideoQualityMetricsDto;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView.ProductionTakeQualityItem;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.SceneColor;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TakeQualityReadModelTest {
  private final TakeQualityReadModel readModel =
      new TakeQualityReadModel(new TakeQualityEvaluator());

  private static String stored(String qualityControlJson) {
    return "{\"whisperx\":{\"status\":\"OK\"},\"qualityControl\":" + qualityControlJson + "}";
  }

  private static final String FROZEN_OPENING =
      "{\"status\":\"MEASURED\",\"scorerVersion\":\"FFMPEG_TAKE_QC_V1\",\"freezeHeadMs\":900,"
          + "\"freezeTotalMs\":900,\"motionMean\":3.0,\"sceneCutCount\":0,\"flickerStddev\":0.5,"
          + "\"blackTotalMs\":0,\"silenceTotalMs\":0,\"integratedLufs\":-19.0,\"peakDbfs\":-3.0,"
          + "\"meanY\":120.0,\"meanU\":127.0,\"meanV\":128.0}";

  private static VideoQualityMetricsDto color(double y, double u, double v) {
    return new VideoQualityMetricsDto(
        "MEASURED", "FFMPEG_TAKE_QC_V1", null, 0L, 0L, 3.0, 0, 0.5, 0L, 0L, -19.0, -3.0, y, u, v);
  }

  @Test
  void storedMeasurementsAreAssessedWithWarningsAndRawMetrics() {
    ProductionTakeQualityItem quality =
        readModel.assess(stored(FROZEN_OPENING), 5000L, false, Optional.empty());

    assertThat(quality.level()).isEqualTo("REVIEW");
    assertThat(quality.thresholdsVersion()).isEqualTo("TAKE_QC_THRESHOLDS_V1");
    assertThat(quality.warnings()).extracting("code").containsExactly("FREEZE_HEAD");
    assertThat(quality.metrics().freezeHeadMs()).isEqualTo(900L);
  }

  @Test
  void takesWithoutStoredQualityAreUnmeasured() {
    for (String json : new String[] {null, "", "{}", "{\"whisperx\":{}}", "not json"}) {
      ProductionTakeQualityItem quality = readModel.assess(json, 5000L, false, Optional.empty());

      assertThat(quality.level()).as("metricsJson=%s", json).isEqualTo("UNMEASURED");
      assertThat(quality.warnings()).isEmpty();
      assertThat(quality.metrics()).isNull();
    }
  }

  @Test
  void unavailableMeasurementIsUnmeasuredButKeepsItsReason() {
    ProductionTakeQualityItem quality =
        readModel.assess(
            stored(
                "{\"status\":\"UNAVAILABLE\",\"scorerVersion\":\"FFMPEG_TAKE_QC_V1\",\"reason\":\"timed out\"}"),
            5000L,
            false,
            Optional.empty());

    assertThat(quality.level()).isEqualTo("UNMEASURED");
    assertThat(quality.metrics().reason()).isEqualTo("timed out");
  }

  @Test
  void speechExpectationControlsTheSilenceWarning() {
    String silent = FROZEN_OPENING.replace("\"silenceTotalMs\":0", "\"silenceTotalMs\":5000");

    assertThat(readModel.assess(stored(silent), 5000L, true, Optional.empty()).warnings())
        .extracting("code")
        .contains("SILENT_DIALOGUE");
    assertThat(readModel.assess(stored(silent), 5000L, false, Optional.empty()).warnings())
        .extracting("code")
        .doesNotContain("SILENT_DIALOGUE");
  }

  @Test
  void sceneColorReferenceFeedsTheColorDriftWarning() {
    ProductionTakeQualityItem quality =
        readModel.assess(
            stored(FROZEN_OPENING), 5000L, false, Optional.of(new SceneColor(170, 127, 128)));

    assertThat(quality.warnings()).extracting("code").contains("COLOR_DRIFT");
  }

  @Test
  void sceneReferenceIsTheMedianOfTheOtherSelectedTakes() {
    Optional<SceneColor> reference =
        readModel.sceneReference(
            List.of(color(100, 120, 130), color(110, 125, 128), color(300, 200, 100)));

    assertThat(reference).contains(new SceneColor(110, 125, 128));
  }

  @Test
  void sceneReferenceOfTwoTakesIsTheirMean() {
    assertThat(readModel.sceneReference(List.of(color(100, 120, 130), color(110, 130, 140))))
        .contains(new SceneColor(105, 125, 135));
  }

  @Test
  void sceneWithoutOtherMeasuredTakesHasNoReference() {
    VideoQualityMetricsDto unavailable =
        new VideoQualityMetricsDto(
            "UNAVAILABLE",
            "FFMPEG_TAKE_QC_V1",
            "x",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    assertThat(readModel.sceneReference(List.of())).isEmpty();
    assertThat(readModel.sceneReference(List.of(unavailable))).isEmpty();
  }

  @Test
  void storedMetricsAreReadFromTheQualityControlKeyOnly() {
    assertThat(readModel.storedMetrics(stored(FROZEN_OPENING))).isPresent();
    assertThat(readModel.storedMetrics("{\"freezeHeadMs\":900}")).isEmpty();
  }
}
