package com.narrativex.backend.feature.assets.domain;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.assets.domain.enums.MediaAssetStatus;
import com.narrativex.backend.feature.assets.domain.exception.InvalidMediaAssetTransitionException;
import com.narrativex.backend.feature.assets.domain.service.MediaAssetTransitionService;
import org.junit.jupiter.api.Test;

class MediaAssetTransitionServiceTest {
  private final MediaAssetTransitionService service = new MediaAssetTransitionService();

  @Test
  void allowsOnlyTheVerifiedLifecycleTransitions() {
    service.requireAllowed(MediaAssetStatus.PENDING_UPLOAD, MediaAssetStatus.UPLOADING);
    service.requireAllowed(MediaAssetStatus.UPLOADING, MediaAssetStatus.VALIDATING);
    service.requireAllowed(MediaAssetStatus.VALIDATING, MediaAssetStatus.READY);
    service.requireAllowed(MediaAssetStatus.VALIDATING, MediaAssetStatus.REJECTED);
    service.requireAllowed(MediaAssetStatus.READY, MediaAssetStatus.DELETED);
  }

  @Test
  void rejectsDirectOrTerminalStatusChanges() {
    assertThatThrownBy(
            () -> service.requireAllowed(MediaAssetStatus.PENDING_UPLOAD, MediaAssetStatus.READY))
        .isInstanceOf(InvalidMediaAssetTransitionException.class);
    assertThatThrownBy(
            () -> service.requireAllowed(MediaAssetStatus.READY, MediaAssetStatus.VALIDATING))
        .isInstanceOf(InvalidMediaAssetTransitionException.class);
    assertThatThrownBy(
            () -> service.requireAllowed(MediaAssetStatus.DELETED, MediaAssetStatus.READY))
        .isInstanceOf(InvalidMediaAssetTransitionException.class);
  }
}
