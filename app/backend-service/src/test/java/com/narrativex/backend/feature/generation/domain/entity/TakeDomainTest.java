package com.narrativex.backend.feature.generation.domain.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TakeDomainTest {

  @Test
  void takeHoldsValidationTaxonomyAndMetrics() {
    UUID shotId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    Take passedTake =
        new Take(
            shotId,
            1,
            "ltx",
            "ltx-2.5-nvfp4",
            GenerationStrategy.IMAGE_TO_VIDEO,
            assetId,
            5000L,
            "{\"generationTimeMs\":8200,\"vramPeakMb\":14200}",
            "PASSED",
            null,
            null,
            null,
            "PASSED");

    assertThat(passedTake.getShotId()).isEqualTo(shotId);
    assertThat(passedTake.getAttemptNumber()).isEqualTo(1);
    assertThat(passedTake.getOutputAssetId()).isEqualTo(assetId);
    assertThat(passedTake.getSourceDurationMs()).isEqualTo(5000L);
    assertThat(passedTake.getValidationFailureCategory()).isNull();
    assertThat(passedTake.getStatus()).isEqualTo("PASSED");
  }

  @Test
  void takeRecordsDetailedFailureReasonAndRecommendation() {
    UUID shotId = UUID.randomUUID();

    Take failedTake =
        new Take(
            shotId,
            2,
            "ltx",
            "ltx-2.5-nvfp4",
            GenerationStrategy.TEXT_TO_VIDEO,
            null,
            null,
            "{\"generationTimeMs\":7900}",
            "FAILED",
            VideoQAFailureCategory.FACE_IDENTITY,
            "Facial features drifted significantly after frame 48",
            "Switch to IMAGE_TO_VIDEO using character reference sheet or increase face conditioning weight",
            "FAILED");

    assertThat(failedTake.getValidationStatus()).isEqualTo("FAILED");
    assertThat(failedTake.getValidationFailureCategory())
        .isEqualTo(VideoQAFailureCategory.FACE_IDENTITY);
    assertThat(failedTake.getValidationFailureReason())
        .contains("drifted significantly");
    assertThat(failedTake.getValidationRetryRecommendation())
        .contains("Switch to IMAGE_TO_VIDEO");
  }

  @Test
  void selectedTakeEnforcesValidInOutSpan() {
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    SelectedTake selected = new SelectedTake(shotId, takeId, 500L, 3200L);
    assertThat(selected.shotId()).isEqualTo(shotId);
    assertThat(selected.takeId()).isEqualTo(takeId);
    assertThat(selected.sourceInMs()).isEqualTo(500L);
    assertThat(selected.sourceOutMs()).isEqualTo(3200L);
    assertThat(selected.editDurationMs()).isEqualTo(2700L);

    // Negative in point
    assertThatThrownBy(() -> new SelectedTake(shotId, takeId, -100L, 2000L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sourceInMs must not be negative");

    // Out point <= In point
    assertThatThrownBy(() -> new SelectedTake(shotId, takeId, 1000L, 1000L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("strictly greater than sourceInMs");

    assertThatThrownBy(() -> new SelectedTake(shotId, takeId, 2000L, 1000L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("strictly greater than sourceInMs");
  }
}
