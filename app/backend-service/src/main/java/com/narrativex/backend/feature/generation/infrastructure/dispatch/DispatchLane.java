package com.narrativex.backend.feature.generation.infrastructure.dispatch;

/**
 * Concurrency lane for outbox dispatch. A slow lane (long provider calls) must not starve a fast
 * one, so each lane has its own bounded number of in-flight handlers.
 */
public enum DispatchLane {
  /** Long synchronous provider calls (chapter analysis). */
  ANALYSIS,
  /** Short submissions to the compute plane and batch projection. */
  MEDIA
}
