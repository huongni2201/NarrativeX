package com.narrativex.backend.feature.storyboard.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import org.junit.jupiter.api.Test;

class VisualBeatReviewTest {
  @Test
  void newBeatStartsInNeedsReviewAndCanBeApproved() {
    VisualBeat beat = new VisualBeat(1L, 0, "Đội quân xuất phát", "Wide cinematic shot");

    assertEquals("Đội quân xuất phát", beat.getTitle());
    assertEquals(VisualBeatReviewStatus.NEEDS_REVIEW, beat.getReviewStatus());

    beat.changeReviewStatus(VisualBeatReviewStatus.APPROVED);

    assertEquals(VisualBeatReviewStatus.APPROVED, beat.getReviewStatus());
  }

  @Test
  void beatRejectsBlankOrOversizedUserFacingFields() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new VisualBeat(1L, 0, " ", "Wide cinematic shot"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new VisualBeat(1L, 0, "Title", "x".repeat(8001)));
  }
}
