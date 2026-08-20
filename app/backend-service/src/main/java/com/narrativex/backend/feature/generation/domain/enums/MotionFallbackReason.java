package com.narrativex.backend.feature.generation.domain.enums;

public enum MotionFallbackReason {
  PROVIDER_UNAVAILABLE,
  PROVIDER_TIMEOUT,
  GPU_CAPACITY,
  QUOTA_EXCEEDED,
  COST_LIMIT,
  RETRY_EXHAUSTED
}
