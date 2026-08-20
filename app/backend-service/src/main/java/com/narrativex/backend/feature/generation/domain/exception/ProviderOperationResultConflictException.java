package com.narrativex.backend.feature.generation.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class ProviderOperationResultConflictException extends DomainConflictException {
  public ProviderOperationResultConflictException(String message) {
    super(message);
  }
}
