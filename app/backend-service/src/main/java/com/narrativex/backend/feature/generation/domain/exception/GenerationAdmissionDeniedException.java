package com.narrativex.backend.feature.generation.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

/** Raised when an expensive generation operation cannot pass admission controls. */
public final class GenerationAdmissionDeniedException extends DomainConflictException {
  public GenerationAdmissionDeniedException(String message) {
    super(message);
  }
}
