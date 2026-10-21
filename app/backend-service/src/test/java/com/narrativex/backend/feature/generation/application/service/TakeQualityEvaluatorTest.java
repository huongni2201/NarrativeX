package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.model.compute.VideoQualityMetricsDto;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Assessment;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Context;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Level;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.SceneColor;
import com.narrativex.backend.feature.generation.application.service.TakeQualityEvaluator.Severity;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;

/** Thresholds below are the documented starting values of TAKE_QC_THRESHOLDS_V1. */
class TakeQualityEvaluatorTest {
  private static final long DURATION_MS = 5000;
  private final TakeQualityEvaluator evaluator = new TakeQualityEvaluator();

  /** Mutable copy of a clean measurement so each test states only what makes it differ. */
  private record Measured(
      long freezeHeadMs,
      long freezeTotalMs,
      double motionMean,
      int sceneCutCount,
      double flickerStddev,
      long blackTotalMs,
      long silenceTotalMs,
      double integratedLufs,
      double peakDbfs,
      double meanY,
      double meanU,
      double meanV) {
    static Measured clean() {
      return new Measured(0, 0, 3.0, 0, 0.5, 0, 0, -19.0, -3.0, 120.0, 127.0, 128.0);
    }

    VideoQualityMetricsDto dto() {
      return new VideoQualityMetricsDto(
          "MEASURED",
          "FFMPEG_TAKE_QC_V1",
          null,
          freezeHeadMs,
          freezeTotalMs,
          motionMean,
          sceneCutCount,
          flickerStddev,
          blackTotalMs,
          silenceTotalMs,
          integratedLufs,
          peakDbfs,
          meanY,
          meanU,
          meanV);
    }
  }

  private Assessment assess(UnaryOperator<Measured> change, Context context) {
    return evaluator.evaluate(change.apply(Measured.clean()).dto(), DURATION_MS, context);
  }

  private Assessment assess(UnaryOperator<Measured> change) {
    return assess(change, Context.none());
  }

  private static void assertSingleWarning(
      Assessment assessment,
      String code,
      VideoQAFailureCategory category,
      Severity severity,
      Level level) {
    assertThat(assessment.level()).isEqualTo(level);
    assertThat(assessment.warnings()).hasSize(1);
    assertThat(assessment.warnings().get(0).code()).isEqualTo(code);
    assertThat(assessment.warnings().get(0).category()).isEqualTo(category);
    assertThat(assessment.warnings().get(0).severity()).isEqualTo(severity);
  }

  @Test
  void cleanTakeIsGoodAndCarriesThresholdVersion() {
    Assessment assessment = assess(m -> m);

    assertThat(assessment.level()).isEqualTo(Level.GOOD);
    assertThat(assessment.warnings()).isEmpty();
    assertThat(assessment.thresholdsVersion()).isEqualTo("TAKE_QC_THRESHOLDS_V1");
  }

  @Test
  void takeWithoutMeasurementsIsUnmeasured() {
    assertThat(evaluator.evaluate(null, DURATION_MS, Context.none()).level())
        .isEqualTo(Level.UNMEASURED);
  }

  @Test
  void unavailableMeasurementIsUnmeasuredNotGood() {
    VideoQualityMetricsDto unavailable =
        new VideoQualityMetricsDto(
            "UNAVAILABLE",
            "FFMPEG_TAKE_QC_V1",
            "timed out",
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

    Assessment assessment = evaluator.evaluate(unavailable, DURATION_MS, Context.none());

    assertThat(assessment.level()).isEqualTo(Level.UNMEASURED);
    assertThat(assessment.warnings()).isEmpty();
  }

  @Test
  void frozenOpeningAboveHalfSecondAsksForReview() {
    assertSingleWarning(
        assess(m -> new Measured(501, 501, m.motionMean(), 0, 0.5, 0, 0, -19, -3, 120, 127, 128)),
        "FREEZE_HEAD",
        VideoQAFailureCategory.MOTION,
        Severity.REVIEW,
        Level.REVIEW);
  }

  @Test
  void frozenOpeningOfExactlyHalfSecondIsNotFlagged() {
    assertThat(
            assess(
                    m ->
                        new Measured(
                            500, 500, m.motionMean(), 0, 0.5, 0, 0, -19, -3, 120, 127, 128))
                .level())
        .isEqualTo(Level.GOOD);
  }

  @Test
  void freezeCoveringMoreThanQuarterOfTheClipIsADefect() {
    assertSingleWarning(
        assess(m -> new Measured(0, 1251, m.motionMean(), 0, 0.5, 0, 0, -19, -3, 120, 127, 128)),
        "FREEZE_TOTAL",
        VideoQAFailureCategory.MOTION,
        Severity.DEFECT,
        Level.DEFECT);
  }

  @Test
  void freezeOfExactlyQuarterIsNotFlagged() {
    assertThat(
            assess(m -> new Measured(0, 1250, m.motionMean(), 0, 0.5, 0, 0, -19, -3, 120, 127, 128))
                .level())
        .isEqualTo(Level.GOOD);
  }

  @Test
  void lowMotionAsksForReview() {
    assertSingleWarning(
        assess(m -> new Measured(0, 0, 0.4, 0, 0.5, 0, 0, -19, -3, 120, 127, 128)),
        "LOW_MOTION",
        VideoQAFailureCategory.MOTION,
        Severity.REVIEW,
        Level.REVIEW);
  }

  @Test
  void hardCutInsideTheClipIsADefect() {
    assertSingleWarning(
        assess(m -> new Measured(0, 0, 3.0, 1, 0.5, 0, 0, -19, -3, 120, 127, 128)),
        "HARD_CUT",
        VideoQAFailureCategory.TEMPORAL_ARTIFACT,
        Severity.DEFECT,
        Level.DEFECT);
  }

  @Test
  void brightnessFlickerAsksForReview() {
    assertSingleWarning(
        assess(m -> new Measured(0, 0, 3.0, 0, 8.1, 0, 0, -19, -3, 120, 127, 128)),
        "FLICKER",
        VideoQAFailureCategory.TEMPORAL_ARTIFACT,
        Severity.REVIEW,
        Level.REVIEW);
  }

  @Test
  void blackFramesLongerThanTwoTenthsOfASecondAreADefect() {
    assertSingleWarning(
        assess(m -> new Measured(0, 0, 3.0, 0, 0.5, 201, 0, -19, -3, 120, 127, 128)),
        "BLACK_FRAMES",
        VideoQAFailureCategory.TECHNICAL_OUTPUT,
        Severity.DEFECT,
        Level.DEFECT);
  }

  @Test
  void silenceOverSixtyPercentOfASpeakingShotIsADefect() {
    Assessment assessment =
        assess(
            m -> new Measured(0, 0, 3.0, 0, 0.5, 0, 3001, -19, -3, 120, 127, 128),
            new Context(true, null));

    assertSingleWarning(
        assessment,
        "SILENT_DIALOGUE",
        VideoQAFailureCategory.DURATION,
        Severity.DEFECT,
        Level.DEFECT);
  }

  @Test
  void silenceIsFineWhenTheShotHasNoSpeech() {
    assertThat(
            assess(
                    m -> new Measured(0, 0, 3.0, 0, 0.5, 0, 5000, -19, -3, 120, 127, 128),
                    Context.none())
                .level())
        .isEqualTo(Level.GOOD);
  }

  @Test
  void clippedAudioAsksForReview() {
    assertSingleWarning(
        assess(m -> new Measured(0, 0, 3.0, 0, 0.5, 0, 0, -19, 0.0, 120, 127, 128)),
        "CLIPPING",
        VideoQAFailureCategory.TECHNICAL_OUTPUT,
        Severity.REVIEW,
        Level.REVIEW);
  }

  @Test
  void audioQuieterThanMinusThirtyFiveLufsAsksForReview() {
    assertSingleWarning(
        assess(m -> new Measured(0, 0, 3.0, 0, 0.5, 0, 0, -36, -20, 120, 127, 128)),
        "AUDIO_TOO_QUIET",
        VideoQAFailureCategory.TECHNICAL_OUTPUT,
        Severity.REVIEW,
        Level.REVIEW);
  }

  @Test
  void colorFarFromTheSceneReferenceAsksForReview() {
    Assessment assessment = assess(m -> m, new Context(false, new SceneColor(160.0, 127.0, 128.0)));

    assertSingleWarning(
        assessment,
        "COLOR_DRIFT",
        VideoQAFailureCategory.CONTINUITY,
        Severity.REVIEW,
        Level.REVIEW);
  }

  @Test
  void colorCloseToTheSceneReferenceIsGood() {
    assertThat(assess(m -> m, new Context(false, new SceneColor(125.0, 129.0, 126.0))).level())
        .isEqualTo(Level.GOOD);
  }

  @Test
  void defectOutranksReviewAndEveryWarningIsKept() {
    Assessment assessment =
        assess(m -> new Measured(600, 600, 3.0, 2, 0.5, 0, 0, -19, -3, 120, 127, 128));

    assertThat(assessment.level()).isEqualTo(Level.DEFECT);
    assertThat(assessment.warnings())
        .extracting(TakeQualityEvaluator.Warning::code)
        .containsExactlyInAnyOrder("FREEZE_HEAD", "HARD_CUT");
  }

  @Test
  void warningReportsMeasuredValueAndThreshold() {
    TakeQualityEvaluator.Warning warning =
        assess(m -> new Measured(0, 0, 3.0, 0, 0.5, 350, 0, -19, -3, 120, 127, 128))
            .warnings()
            .get(0);

    assertThat(warning.measured()).isEqualTo(350.0);
    assertThat(warning.threshold()).isEqualTo(200.0);
  }
}
