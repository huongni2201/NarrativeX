package com.narrativex.backend.feature.generation.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class InvalidProviderOperationTransitionException extends DomainConflictException {
  public InvalidProviderOperationTransitionException(String message) {
    super(message);
  }
}
