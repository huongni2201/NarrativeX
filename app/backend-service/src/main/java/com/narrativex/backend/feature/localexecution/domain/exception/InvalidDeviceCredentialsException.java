package com.narrativex.backend.feature.localexecution.domain.exception;

public class InvalidDeviceCredentialsException extends RuntimeException {
  public InvalidDeviceCredentialsException(String message) {
    super(message);
  }
}

