package com.narrativex.backend.feature.project.application.port.out;

import java.util.Optional;

public interface ChapterCreationIdempotencyRepository {
  Optional<Reservation> reserve(
      String ownerId, Long projectId, String idempotencyKey, String requestFingerprint);

  void complete(Long reservationId, Long chapterId);

  record Reservation(
      Long id,
      String ownerId,
      Long projectId,
      String idempotencyKey,
      String requestFingerprint,
      Long chapterId) {}
}
