package com.narrativex.backend.feature.storyboard.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VisualBeatReviewTest {
  @Test
  void newBeatStartsInNeedsReviewAndCanBeApproved() {
    UUID sceneId = UuidV7.random();
    VisualBeat beat = new VisualBeat(sceneId, 0, "Đội quân xuất phát", "Wide cinematic shot");

    assertEquals("Đội quân xuất phát", beat.getTitle());
    assertEquals(MotionMode.STILL, beat.getMotionMode());
    assertEquals(VisualBeatReviewStatus.NEEDS_REVIEW, beat.getReviewStatus());

    beat.changeReviewStatus(VisualBeatReviewStatus.APPROVED);

    assertEquals(VisualBeatReviewStatus.APPROVED, beat.getReviewStatus());
  }

  @Test
  void beatRejectsBlankOrOversizedUserFacingFields() {
    UUID sceneId = UuidV7.random();
    assertThrows(
        IllegalArgumentException.class,
        () -> new VisualBeat(sceneId, 0, " ", "Wide cinematic shot"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new VisualBeat(sceneId, 0, "Title", "x".repeat(8001)));
  }

  @Test
  void attachingPreviewMediaResetsReviewToNeedsReview() {
    UUID sceneId = UuidV7.random();
    UUID assetId = UuidV7.random();
    VisualBeat beat = new VisualBeat(sceneId, 0, "Đội quân xuất phát", "Wide cinematic shot");
    beat.changeReviewStatus(VisualBeatReviewStatus.APPROVED);

    beat.attachPreviewMediaAsset(assetId);

    assertEquals(assetId, beat.getPreviewMediaAssetId());
    assertEquals(VisualBeatReviewStatus.NEEDS_REVIEW, beat.getReviewStatus());
  }
}
