package com.narrativex.backend.feature.generation.infrastructure.compute;

public class ComputeClientException extends RuntimeException {
  private final int statusCode;

  public ComputeClientException(String message) {
    super(message);
    this.statusCode = 0;
  }

  public ComputeClientException(int statusCode, String message) {
    super("Compute service returned HTTP " + statusCode + ": " + message);
    this.statusCode = statusCode;
  }

  public ComputeClientException(String message, Throwable cause) {
    super(message, cause);
    this.statusCode = 0;
  }

  public int getStatusCode() {
    return statusCode;
  }
}
