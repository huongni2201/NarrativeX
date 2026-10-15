package com.narrativex.backend.feature.generation.infrastructure.sse;

import com.narrativex.backend.feature.generation.application.event.GenerationJobChangedEvent;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Bridges {@link GenerationJobChangedEvent} to the SSE broadcaster strictly after commit.
 *
 * <p>{@code fallbackExecution = true} keeps callers that run without a transaction (for example
 * reconciliation) broadcasting immediately. Broadcast failures never propagate: a dead SSE client
 * must not affect a callback result that has already been committed.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GenerationJobChangedListener {

  private final GenerationJobEventBroadcaster broadcaster;

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  void on(GenerationJobChangedEvent event) {
    try {
      broadcaster.broadcastJobEvent(event.job());
    } catch (RuntimeException ex) {
      log.warn(
          "Failed to broadcast job {} change: {}", event.job().getJobId(), ex.getMessage(), ex);
    }
  }
}
