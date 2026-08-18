package com.narrativex.backend.feature.auth.application.exception;

public final class AuthRateLimitExceededException extends RuntimeException {
  private final long retryAfterSeconds;

  public AuthRateLimitExceededException(long retryAfterSeconds) {
    super("Too many authentication attempts. Please try again later.");
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }

  public long retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
