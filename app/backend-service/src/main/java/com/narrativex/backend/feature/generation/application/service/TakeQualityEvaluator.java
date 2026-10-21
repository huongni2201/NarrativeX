package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.compute.VideoQualityMetricsDto;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Turns raw worker measurements into advisory warnings. It runs on read, so changing a threshold
 * never needs a regeneration, and it never touches a Take's validation status.
 *
 * <p>The numbers are TAKE_QC_THRESHOLDS_V2 starting values from the video quality plan (P1); the
 * ones the plan leaves open (motion, flicker, color drift, frozen tail, white frames) are
 * uncalibrated until P1.6. V2 adds the frozen tail and white-frame rules to V1; every V1 rule keeps
 * its value. A measurement a take lacks (it was scored before V2) simply raises no such warning.
 */
@Component
public class TakeQualityEvaluator {
  public static final String THRESHOLDS_VERSION = "TAKE_QC_THRESHOLDS_V2";

  private static final double FREEZE_HEAD_MS = 500;
  private static final double FREEZE_TOTAL_RATIO = 0.25;
  private static final double LOW_MOTION_YDIF = 0.5;
  private static final double FLICKER_STDDEV = 8.0;
  private static final double FREEZE_TAIL_MS = 500;
  private static final double BLACK_MS = 200;
  private static final double WHITE_MS = 200;
  private static final double SILENCE_RATIO = 0.60;
  private static final double CLIPPING_DBFS = -0.1;
  private static final double QUIET_LUFS = -35;
  private static final double COLOR_DRIFT_Y = 25;
  private static final double COLOR_DRIFT_UV = 10;

  public enum Level {
    GOOD,
    REVIEW,
    DEFECT,
    UNMEASURED
  }

  public enum Severity {
    REVIEW,
    DEFECT
  }

  /** Median color signature of the other selected takes in the same scene. */
  public record SceneColor(double meanY, double meanU, double meanV) {}

  /**
   * Whether the Take was generated with speech to voice. It comes from the Take's own frozen input
   * snapshot, never from the Story's current cues; {@code UNKNOWN} (data predating the snapshot
   * field) makes no claim about speech.
   */
  public enum SpeechExpectation {
    EXPECTED,
    NOT_EXPECTED,
    UNKNOWN
  }

  public record Context(SpeechExpectation speech, SceneColor sceneColor) {
    public static Context none() {
      return new Context(SpeechExpectation.UNKNOWN, null);
    }
  }

  public record Warning(
      String code,
      VideoQAFailureCategory category,
      Severity severity,
      double measured,
      double threshold) {}

  public record Assessment(String thresholdsVersion, Level level, List<Warning> warnings) {}

  public Assessment evaluate(VideoQualityMetricsDto metrics, long durationMs, Context context) {
    if (metrics == null || !metrics.measured()) {
      return new Assessment(THRESHOLDS_VERSION, Level.UNMEASURED, List.of());
    }
    List<Warning> warnings = new ArrayList<>();
    if (metrics.freezeHeadMs() != null && metrics.freezeHeadMs() > FREEZE_HEAD_MS) {
      warnings.add(
          warn(
              "FREEZE_HEAD",
              VideoQAFailureCategory.MOTION,
              Severity.REVIEW,
              metrics.freezeHeadMs(),
              FREEZE_HEAD_MS));
    }
    if (metrics.freezeTailMs() != null && metrics.freezeTailMs() > FREEZE_TAIL_MS) {
      warnings.add(
          warn(
              "FREEZE_TAIL",
              VideoQAFailureCategory.MOTION,
              Severity.REVIEW,
              metrics.freezeTailMs(),
              FREEZE_TAIL_MS));
    }
    if (metrics.freezeTotalMs() != null
        && durationMs > 0
        && metrics.freezeTotalMs() > durationMs * FREEZE_TOTAL_RATIO) {
      warnings.add(
          warn(
              "FREEZE_TOTAL",
              VideoQAFailureCategory.MOTION,
              Severity.DEFECT,
              metrics.freezeTotalMs(),
              durationMs * FREEZE_TOTAL_RATIO));
    }
    if (metrics.motionMean() != null && metrics.motionMean() < LOW_MOTION_YDIF) {
      warnings.add(
          warn(
              "LOW_MOTION",
              VideoQAFailureCategory.MOTION,
              Severity.REVIEW,
              metrics.motionMean(),
              LOW_MOTION_YDIF));
    }
    if (metrics.sceneCutCount() != null && metrics.sceneCutCount() >= 1) {
      warnings.add(
          warn(
              "HARD_CUT",
              VideoQAFailureCategory.TEMPORAL_ARTIFACT,
              Severity.DEFECT,
              metrics.sceneCutCount(),
              1));
    }
    if (metrics.flickerStddev() != null && metrics.flickerStddev() > FLICKER_STDDEV) {
      warnings.add(
          warn(
              "FLICKER",
              VideoQAFailureCategory.TEMPORAL_ARTIFACT,
              Severity.REVIEW,
              metrics.flickerStddev(),
              FLICKER_STDDEV));
    }
    if (metrics.blackTotalMs() != null && metrics.blackTotalMs() > BLACK_MS) {
      warnings.add(
          warn(
              "BLACK_FRAMES",
              VideoQAFailureCategory.TECHNICAL_OUTPUT,
              Severity.DEFECT,
              metrics.blackTotalMs(),
              BLACK_MS));
    }
    if (metrics.whiteTotalMs() != null && metrics.whiteTotalMs() > WHITE_MS) {
      // REVIEW, not DEFECT: a white flash can be intended, and the threshold is uncalibrated.
      warnings.add(
          warn(
              "WHITE_FRAMES",
              VideoQAFailureCategory.TECHNICAL_OUTPUT,
              Severity.REVIEW,
              metrics.whiteTotalMs(),
              WHITE_MS));
    }
    if (context.speech() == SpeechExpectation.EXPECTED
        && metrics.silenceTotalMs() != null
        && durationMs > 0
        && metrics.silenceTotalMs() > durationMs * SILENCE_RATIO) {
      warnings.add(
          warn(
              "SILENT_DIALOGUE",
              VideoQAFailureCategory.DURATION,
              Severity.DEFECT,
              metrics.silenceTotalMs(),
              durationMs * SILENCE_RATIO));
    }
    if (metrics.peakDbfs() != null && metrics.peakDbfs() >= CLIPPING_DBFS) {
      warnings.add(
          warn(
              "CLIPPING",
              VideoQAFailureCategory.TECHNICAL_OUTPUT,
              Severity.REVIEW,
              metrics.peakDbfs(),
              CLIPPING_DBFS));
    }
    if (metrics.integratedLufs() != null && metrics.integratedLufs() < QUIET_LUFS) {
      warnings.add(
          warn(
              "AUDIO_TOO_QUIET",
              VideoQAFailureCategory.TECHNICAL_OUTPUT,
              Severity.REVIEW,
              metrics.integratedLufs(),
              QUIET_LUFS));
    }
    colorDrift(metrics, context.sceneColor()).ifPresent(warnings::add);
    return new Assessment(THRESHOLDS_VERSION, levelOf(warnings), List.copyOf(warnings));
  }

  private static java.util.Optional<Warning> colorDrift(
      VideoQualityMetricsDto metrics, SceneColor reference) {
    if (reference == null
        || metrics.meanY() == null
        || metrics.meanU() == null
        || metrics.meanV() == null) {
      return java.util.Optional.empty();
    }
    double dy = Math.abs(metrics.meanY() - reference.meanY());
    double du = Math.abs(metrics.meanU() - reference.meanU());
    double dv = Math.abs(metrics.meanV() - reference.meanV());
    if (dy > COLOR_DRIFT_Y) {
      return java.util.Optional.of(
          warn(
              "COLOR_DRIFT",
              VideoQAFailureCategory.CONTINUITY,
              Severity.REVIEW,
              dy,
              COLOR_DRIFT_Y));
    }
    double chroma = Math.max(du, dv);
    if (chroma > COLOR_DRIFT_UV) {
      return java.util.Optional.of(
          warn(
              "COLOR_DRIFT",
              VideoQAFailureCategory.CONTINUITY,
              Severity.REVIEW,
              chroma,
              COLOR_DRIFT_UV));
    }
    return java.util.Optional.empty();
  }

  private static Level levelOf(List<Warning> warnings) {
    if (warnings.stream().anyMatch(warning -> warning.severity() == Severity.DEFECT)) {
      return Level.DEFECT;
    }
    return warnings.isEmpty() ? Level.GOOD : Level.REVIEW;
  }

  private static Warning warn(
      String code,
      VideoQAFailureCategory category,
      Severity severity,
      double measured,
      double threshold) {
    return new Warning(code, category, severity, measured, threshold);
  }
}
