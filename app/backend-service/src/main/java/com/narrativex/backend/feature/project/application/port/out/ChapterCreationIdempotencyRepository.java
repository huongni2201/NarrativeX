package com.narrativex.backend.feature.project.application.port.out;

import java.util.Optional;
import java.util.UUID;

public interface ChapterCreationIdempotencyRepository {
  Optional<Reservation> reserve(
      String ownerId, UUID projectId, String idempotencyKey, String requestFingerprint);

  void complete(Long reservationId, UUID chapterId);

  record Reservation(
      Long id,
      String ownerId,
      UUID projectId,
      String idempotencyKey,
      String requestFingerprint,
      UUID chapterId) {}
}
