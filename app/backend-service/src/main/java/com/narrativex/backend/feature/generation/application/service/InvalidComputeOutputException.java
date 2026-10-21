package com.narrativex.backend.feature.generation.application.service;

/**
 * The worker reported success but its output can never be accepted (missing artifact, wrong audio
 * format, unusable alignment). Retrying finalization cannot change that, so callers fail the job
 * instead of re-reconciling it forever. Finalizers throw it before writing anything.
 */
public class InvalidComputeOutputException extends RuntimeException {
  public static final String ERROR_CODE = "COMPUTE_OUTPUT_INVALID";

  public InvalidComputeOutputException(String message) {
    super(message);
  }

  public InvalidComputeOutputException(String message, Throwable cause) {
    super(message, cause);
  }
}
