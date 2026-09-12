package com.narrativex.backend.feature.generation.application.port.out;

import java.util.Optional;
import java.util.UUID;

/** Durable lifecycle for expensive-job capacity and export reservations in PostgreSQL. */
public interface QuotaReservation {
  Optional<Reservation> reserve(String userId, int maxConcurrentExpensiveJobs);

  default Optional<Reservation> reserveLongformExport(
      String userId, int maxConcurrentExpensiveJobs, Integer maxLongformExportsMonth) {
    return reserve(userId, maxConcurrentExpensiveJobs);
  }

  void bindToGenerationJob(long reservationId, UUID generationJobId);

  boolean consumeForJob(UUID generationJobId);

  boolean releaseForJob(UUID generationJobId);

  record Reservation(long id, String userId, String periodKey, String quotaKind, int units) {}
}
