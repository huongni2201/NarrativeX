package com.narrativex.backend.feature.common.domain.exception;

public class DomainConflictException extends DomainException {
  private final String code;

  public DomainConflictException(String message) {
    super(message);
    this.code = "RESOURCE_CONFLICT";
  }

  public DomainConflictException(String code, String message) {
    super(message);
    this.code = code;
  }

  public DomainConflictException(String message, Throwable cause) {
    super(message, cause);
    this.code = "RESOURCE_CONFLICT";
  }

  public String getCode() {
    return code;
  }
}
