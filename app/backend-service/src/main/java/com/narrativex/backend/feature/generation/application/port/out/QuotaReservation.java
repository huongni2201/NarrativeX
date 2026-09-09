package com.narrativex.backend.feature.generation.application.port.out;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

/** Durable lifecycle for expensive-job capacity and credit reservations in PostgreSQL. */
public interface QuotaReservation {
  Optional<Reservation> reserve(
      String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs);

  default Optional<Reservation> reserveLongformExport(
      String userId,
      BigDecimal estimatedCost,
      int maxConcurrentExpensiveJobs,
      Integer maxLongformExportsMonth) {
    return reserve(userId, estimatedCost, maxConcurrentExpensiveJobs);
  }

  void bindToGenerationJob(long reservationId, UUID generationJobId);

  boolean consumeForJob(UUID generationJobId);

  boolean releaseForJob(UUID generationJobId);

  record Reservation(
      long id,
      String userId,
      String periodKey,
      BigDecimal estimatedCost,
      String quotaKind,
      int units) {
    public Reservation(long id, String userId, String periodKey, BigDecimal estimatedCost) {
      this(id, userId, periodKey, estimatedCost, "CREDIT", 0);
    }
  }
}
