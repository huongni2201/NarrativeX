package com.narrativex.backend.feature.generation.application.port.out;

import java.math.BigDecimal;

/** Atomically reserves expensive-job capacity and estimated credits in PostgreSQL. */
public interface QuotaReservation {
  boolean reserve(String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs);
}
