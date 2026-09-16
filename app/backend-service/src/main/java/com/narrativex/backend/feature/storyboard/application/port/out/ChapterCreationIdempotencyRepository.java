package com.narrativex.backend.feature.storyboard.application.port.out;

import java.util.Optional;
import java.util.UUID;

public interface ChapterCreationIdempotencyRepository {
  Optional<Reservation> reserve(UUID projectId, String idempotencyKey, String requestFingerprint);

  void complete(UUID reservationId, UUID chapterId);

  record Reservation(
      UUID id, UUID projectId, String idempotencyKey, String requestFingerprint, UUID chapterId) {}
}
