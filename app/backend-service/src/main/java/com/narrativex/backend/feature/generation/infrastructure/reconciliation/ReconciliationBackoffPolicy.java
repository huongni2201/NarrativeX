package com.narrativex.backend.feature.generation.infrastructure.reconciliation;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Calculates exponential backoff intervals for scheduled compute reconciliation queries. Schedule:
 * 2s -> 5s -> 10s -> 30s -> 60s -> max 300s.
 */
@Component
public class ReconciliationBackoffPolicy {

  private static final List<Duration> DELAYS =
      List.of(
          Duration.ofSeconds(2),
          Duration.ofSeconds(5),
          Duration.ofSeconds(10),
          Duration.ofSeconds(30),
          Duration.ofSeconds(60));

  private static final Duration MAX_DELAY = Duration.ofSeconds(300);

  public Duration calculateDelay(int attemptCount) {
    if (attemptCount < 0) {
      return DELAYS.get(0);
    }
    if (attemptCount < DELAYS.size()) {
      return DELAYS.get(attemptCount);
    }
    return MAX_DELAY;
  }

  public Instant calculateNextReconcileAt(Instant now, int attemptCount) {
    return now.plus(calculateDelay(attemptCount));
  }
}
