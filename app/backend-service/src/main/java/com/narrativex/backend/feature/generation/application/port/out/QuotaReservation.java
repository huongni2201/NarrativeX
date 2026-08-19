package com.narrativex.backend.feature.generation.application.port.out;

import java.math.BigDecimal;
import java.util.Optional;

/** Durable lifecycle for expensive-job capacity and credit reservations in PostgreSQL. */
public interface QuotaReservation {
  Optional<Reservation> reserve(
      String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs);

  void bindToGenerationJob(long reservationId, long generationJobId);

  boolean consumeForJob(long generationJobId);

  boolean releaseForJob(long generationJobId);

  record Reservation(long id, String userId, String periodKey, BigDecimal estimatedCost) {}
}
