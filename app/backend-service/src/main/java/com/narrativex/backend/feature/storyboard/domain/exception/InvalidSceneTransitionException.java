package com.narrativex.backend.feature.storyboard.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class InvalidSceneTransitionException extends DomainConflictException {
  public InvalidSceneTransitionException(String message) {
    super(message);
  }
}
