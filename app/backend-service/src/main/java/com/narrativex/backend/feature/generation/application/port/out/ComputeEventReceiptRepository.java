package com.narrativex.backend.feature.generation.application.port.out;

import java.time.Instant;
import java.util.UUID;

/**
 * Outbound port for recording and checking received compute callback receipts. Guarantees
 * idempotent deduplication at the application boundary.
 */
public interface ComputeEventReceiptRepository {
  boolean existsByEventId(String eventId);

  void recordReceipt(
      String eventId,
      UUID taskId,
      UUID attemptId,
      Long sequence,
      String eventType,
      Instant receivedAt,
      String payloadHash);
}
