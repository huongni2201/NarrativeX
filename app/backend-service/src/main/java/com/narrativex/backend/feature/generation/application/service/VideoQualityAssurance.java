package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.util.Objects;
import org.springframework.stereotype.Service;

/**
 * Automated Video Quality Assurance service implementing 11-category failure taxonomy and
 * reason-aware non-blind retry recommendations according to ADR-0029 and ADR-0030.
 */
@Service
public class VideoQualityAssurance {

  public static final int MAX_AUTOMATED_RETRIES = 3;

  public record QAEvaluation(
      boolean passed,
      VideoQAFailureCategory failureCategory,
      String failureReason,
      String retryRecommendation,
      boolean escalateToManualReview) {}

  /** Evaluates a candidate take's metrics and inspection results. */
  public QAEvaluation evaluateTake(
      int attemptNumber,
      GenerationStrategy strategy,
      VideoQAFailureCategory detectedFailure,
      String failureDetails) {
    if (detectedFailure == null) {
      return new QAEvaluation(true, null, null, null, false);
    }

    boolean escalate = attemptNumber >= MAX_AUTOMATED_RETRIES;
    String recommendation =
        escalate
            ? "Maximum automated retry attempts ("
                + MAX_AUTOMATED_RETRIES
                + ") exceeded. Escalate to MANUAL_REVIEW for editor intervention."
            : recommendRetryAction(detectedFailure, strategy);

    return new QAEvaluation(
        false,
        detectedFailure,
        failureDetails != null ? failureDetails : detectedFailure.name(),
        recommendation,
        escalate);
  }

  /** Generates targeted, non-blind retry action based on the specific failure category. */
  public String recommendRetryAction(
      VideoQAFailureCategory category, GenerationStrategy currentStrategy) {
    Objects.requireNonNull(category, "category must not be null");

    return switch (category) {
      case FACE_IDENTITY ->
          "Regenerate character reference portrait or increase character reference conditioning weight.";
      case CHARACTER_CONSISTENCY ->
          currentStrategy == GenerationStrategy.TEXT_TO_VIDEO
              ? "Switch strategy from TEXT_TO_VIDEO to IMAGE_TO_VIDEO with canonical character reference."
              : "Re-anchor character wardrobe and facial features in prompt with stricter anti-drift tokens.";
      case ANATOMY ->
          "Reduce kinetic motion intensity, simplify character action, and randomize generation seed.";
      case MOTION ->
          currentStrategy == GenerationStrategy.TEXT_TO_VIDEO
              ? "Switch to FIRST_LAST_FRAME strategy to bound spatial trajectory, or reduce camera motion magnitude."
              : "Dampen subject movement velocity and reduce camera tracking speed.";
      case TEMPORAL_ARTIFACT ->
          "Increase diffusion sampling steps or adjust noise schedule to eliminate flickering.";
      case CAMERA ->
          "Lock camera trajectory to static/dolly and clarify lens focal length at prompt head.";
      case COMPOSITION ->
          "Provide explicit START_FRAME keyframe reference or reinforce shot framing constraints.";
      case PROMPT_ADHERENCE ->
          "Prune secondary background descriptions and place core action verb in leading clause.";
      case CONTINUITY ->
          "Condition on preceding shot tail frame using VIDEO_EXTEND or align color palette.";
      case DURATION -> "Adjust target frame count or flag take for trimming in EditDecisionList.";
      case TECHNICAL_OUTPUT ->
          "Verify GPU worker container health, re-encode MP4 container to standard H.264/yuv420p at 24 FPS.";
    };
  }
}
