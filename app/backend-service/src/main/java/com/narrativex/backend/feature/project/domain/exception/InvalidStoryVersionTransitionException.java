package com.narrativex.backend.feature.project.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class InvalidStoryVersionTransitionException extends DomainConflictException {
  public InvalidStoryVersionTransitionException(String message) {
    super(message);
  }
}
