package com.narrativex.backend.feature.auth.application.exception;

public final class InvalidDesktopGuestCredentialException extends RuntimeException {
  public InvalidDesktopGuestCredentialException() {
    super("Desktop guest credentials are invalid.");
  }
}
