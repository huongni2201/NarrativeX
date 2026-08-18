package com.narrativex.backend.feature.character.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class InvalidProjectCharacterTransitionException extends DomainConflictException {
  public InvalidProjectCharacterTransitionException(String message) {
    super(message);
  }
}
