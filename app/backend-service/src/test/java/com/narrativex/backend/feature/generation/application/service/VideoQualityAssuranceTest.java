package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VideoQualityAssuranceTest {

  private VideoQualityAssurance qa;

  @BeforeEach
  void setUp() {
    qa = new VideoQualityAssurance();
  }

  @Test
  void evaluateTake_passesWhenNoFailureCategory() {
    var result = qa.evaluateTake(1, GenerationStrategy.IMAGE_TO_VIDEO, null, null);
    assertThat(result.passed()).isTrue();
    assertThat(result.failureCategory()).isNull();
    assertThat(result.escalateToManualReview()).isFalse();
  }

  @Test
  void evaluateTake_failsWithReasonAwareRecommendation() {
    var result =
        qa.evaluateTake(
            1,
            GenerationStrategy.IMAGE_TO_VIDEO,
            VideoQAFailureCategory.FACE_IDENTITY,
            "Face drifted at 2.4s");

    assertThat(result.passed()).isFalse();
    assertThat(result.failureCategory()).isEqualTo(VideoQAFailureCategory.FACE_IDENTITY);
    assertThat(result.failureReason()).isEqualTo("Face drifted at 2.4s");
    assertThat(result.retryRecommendation()).contains("character reference conditioning weight");
    assertThat(result.escalateToManualReview()).isFalse();
  }

  @Test
  void evaluateTake_escalatesToManualReviewWhenMaxRetriesReached() {
    var result =
        qa.evaluateTake(
            3,
            GenerationStrategy.IMAGE_TO_VIDEO,
            VideoQAFailureCategory.TEMPORAL_ARTIFACT,
            "Flickering background");

    assertThat(result.passed()).isFalse();
    assertThat(result.escalateToManualReview()).isTrue();
    assertThat(result.retryRecommendation()).contains("MANUAL_REVIEW");
  }
}
