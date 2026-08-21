package com.narrativex.backend.feature.assets.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

public final class InvalidMediaAssetTransitionException extends DomainConflictException {
  public InvalidMediaAssetTransitionException(String message) {
    super(message);
  }
}
