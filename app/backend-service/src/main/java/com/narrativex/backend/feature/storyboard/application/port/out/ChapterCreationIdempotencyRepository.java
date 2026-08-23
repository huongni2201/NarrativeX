package com.narrativex.backend.feature.storyboard.application.port.out;

import java.util.Optional;
import java.util.UUID;

public interface ChapterCreationIdempotencyRepository {
  Optional<Reservation> reserve(
      String ownerId, UUID projectId, String idempotencyKey, String requestFingerprint);

  void complete(UUID reservationId, UUID chapterId);

  record Reservation(
      UUID id,
      String ownerId,
      UUID projectId,
      String idempotencyKey,
      String requestFingerprint,
      UUID chapterId) {}
}
