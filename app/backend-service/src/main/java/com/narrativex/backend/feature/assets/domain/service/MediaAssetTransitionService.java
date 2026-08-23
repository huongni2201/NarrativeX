package com.narrativex.backend.feature.assets.domain.service;

import com.narrativex.backend.feature.assets.domain.enums.MediaAssetStatus;
import com.narrativex.backend.feature.assets.domain.exception.InvalidMediaAssetTransitionException;
import java.util.Map;
import java.util.Set;

/** Central guard for the only status transitions allowed for a media asset. */
public final class MediaAssetTransitionService {
  private static final Map<MediaAssetStatus, Set<MediaAssetStatus>> ALLOWED_TRANSITIONS =
      Map.of(
          MediaAssetStatus.PENDING_UPLOAD, Set.of(MediaAssetStatus.UPLOADING),
          MediaAssetStatus.UPLOADING, Set.of(MediaAssetStatus.VALIDATING),
          MediaAssetStatus.VALIDATING, Set.of(MediaAssetStatus.READY, MediaAssetStatus.REJECTED),
          MediaAssetStatus.READY, Set.of(MediaAssetStatus.DELETED),
          MediaAssetStatus.REJECTED, Set.of(),
          MediaAssetStatus.DELETED, Set.of());

  public void requireAllowed(MediaAssetStatus current, MediaAssetStatus next) {
    if (current == null || next == null || !ALLOWED_TRANSITIONS.get(current).contains(next)) {
      throw new InvalidMediaAssetTransitionException(
          "Media asset cannot transition from " + current + " to " + next);
    }
  }
}
